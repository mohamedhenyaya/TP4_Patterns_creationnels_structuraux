// Lancer : node --test seance4-patterns/tp4-Yaya_Mohamedhen/tp4.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ColissimoApi, DhlClient } from '../tp4/carrierApis.js';
import { Channel, EmailChannel, SmsChannel, PushChannel, createChannel, registerChannel } from './notifications/channels.js';
import { MessageBuilder } from './notifications/MessageBuilder.js';
import { ColissimoAdapter, DhlAdapter } from './shipping/adapters.js';
import { RetryQuote, CachedQuote } from './shipping/decorators.js';
import { ShippingService } from './shipping/ShippingService.js';

const msg = { to: 'alice@exemple.fr', body: 'Colis expédié', priority: 'normale' };
const parcel = { weightKg: 2, zip: '75011' };

// --- Étape 1 · Factory ---------------------------------------------------------

test('Factory : un canal par type, erreur si inconnu', () => {
  assert.ok(createChannel('email') instanceof EmailChannel);
  assert.ok(createChannel('sms') instanceof SmsChannel);
  assert.ok(createChannel('push') instanceof PushChannel);
  assert.equal(createChannel('email').send(msg), '[EMAIL → alice@exemple.fr] Colis expédié');
  assert.equal(createChannel('push').send(msg), '[PUSH → alice@exemple.fr] Colis expédié');
  assert.equal(createChannel('sms').send({ ...msg, to: '0600', body: 'x'.repeat(200) }), `[SMS → 0600] ${'x'.repeat(160)}`);
  assert.throws(() => createChannel('pigeon'), /Canal inconnu : pigeon/);
  assert.throws(() => new Channel().send(msg), /méthode abstraite/);
});

test('Factory (OCP) : Slack ajouté sans modifier channels.js', async () => {
  assert.throws(() => createChannel('slack'), /Canal inconnu/);
  await import('./notifications/slack.js');
  assert.equal(createChannel('slack').send({ to: 'logistique', body: 'Tarifs mis à jour' }), '[SLACK #logistique] Tarifs mis à jour');
  const source = readFileSync(new URL('./notifications/channels.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /slack/i, 'channels.js ne doit pas connaître Slack');
});

test('Factory : une classe qui n’hérite pas de Channel est refusée', () => {
  assert.throws(() => registerChannel('fax', class { send() {} }), /doit hériter de Channel/);
  assert.throws(() => registerChannel('fax', 'pas une classe'), /doit hériter de Channel/);
  assert.throws(() => createChannel('fax'), /Canal inconnu/);
});

// --- Étape 2 · Builder ---------------------------------------------------------

const valid = () => new MessageBuilder()
  .to('alice@exemple.fr')
  .template('Bonjour {{nom}}, votre colis part avec {{transporteur}}.')
  .with('nom', 'Alice')
  .with('transporteur', 'Colissimo');

test('Builder : message valide, priorité normale par défaut', () => {
  assert.deepEqual(valid().priority('haute').build(), {
    to: 'alice@exemple.fr', body: 'Bonjour Alice, votre colis part avec Colissimo.', priority: 'haute',
  });
  assert.equal(valid().build().priority, 'normale');
});

test('Builder : les 4 erreurs sont levées dans build()', () => {
  assert.throws(() => new MessageBuilder().template('x').build(), /Destinataire obligatoire/);
  assert.throws(() => new MessageBuilder().to('a@b.fr').build(), /Gabarit obligatoire/);
  const b = valid().priority('urgente'); // aucune erreur avant build()
  assert.throws(() => b.build(), /Priorité invalide : urgente/);
  assert.throws(() => new MessageBuilder().to('a@b.fr').template('Bonjour {{nom}}').build(), /Variable manquante : nom/);
});

test('Builder : le message construit est gelé', () => {
  const m = valid().build();
  assert.ok(Object.isFrozen(m));
  assert.throws(() => { m.body = 'piraté'; }, TypeError);
});

// --- Étape 3a · Adapter --------------------------------------------------------

test('Adapter : Colissimo et DHL respectent le même contrat', async () => {
  assert.deepEqual(await new ColissimoAdapter(new ColissimoApi()).getQuote(parcel), { carrier: 'Colissimo', price: 9.95, days: 2 });
  assert.deepEqual(await new DhlAdapter(new DhlClient()).getQuote(parcel), { carrier: 'DHL', price: 11, days: 1 });
  await assert.rejects(new ColissimoAdapter(new ColissimoApi()).getQuote({ weightKg: 2, zip: 'ABC' }), /Code postal invalide/);
});

// --- Étape 3b · Decorator ------------------------------------------------------

test('Decorator Retry : absorbe 2 pannes sur 3 essais', async () => {
  const client = new DhlClient({ failFirst: 2 });
  const quote = await new RetryQuote(new DhlAdapter(client), { attempts: 3 }).getQuote(parcel);
  assert.equal(quote.price, 11);
  assert.equal(client.calls, 3);
});

test('Decorator Retry : abandonne après 3 échecs et relance la dernière erreur', async () => {
  const client = new DhlClient({ failFirst: 5 });
  await assert.rejects(new RetryQuote(new DhlAdapter(client)).getQuote(parcel), /503/);
  assert.equal(client.calls, 3);
});

test('Decorator Cache : évite le 2e appel, puis expire', async () => {
  let t = 0;
  const client = new DhlClient();
  const cached = new CachedQuote(new DhlAdapter(client), { ttlMs: 1000, now: () => t });
  await cached.getQuote(parcel);
  await cached.getQuote(parcel);
  assert.equal(client.calls, 1, 'le 2e appel est servi par le cache');
  await cached.getQuote({ weightKg: 3, zip: '75011' });
  assert.equal(client.calls, 2, 'autre poids = autre clé');
  t = 1000;
  await cached.getQuote(parcel);
  assert.equal(client.calls, 3, 'après expiration, le transporteur est rappelé');
});

test('Decorator : composition cache(retry(dhl))', async () => {
  const client = new DhlClient({ failFirst: 1 });
  const dhl = new CachedQuote(new RetryQuote(new DhlAdapter(client)));
  assert.deepEqual(await dhl.getQuote(parcel), { carrier: 'DHL', price: 11, days: 1 });
  assert.deepEqual(await dhl.getQuote(parcel), { carrier: 'DHL', price: 11, days: 1 });
  assert.equal(client.calls, 2, '1 panne + 1 succès, puis cache');
});

// --- Étape 4 · Facade ----------------------------------------------------------

const fake = (carrier, price, days) => ({ getQuote: async () => ({ carrier, price, days }) });
const broken = { getQuote: async () => { throw new Error('503 Service Unavailable'); } };
const realCarriers = () => [
  new ColissimoAdapter(new ColissimoApi()),
  new RetryQuote(new DhlAdapter(new DhlClient({ failFirst: 1 }))),
];

test('Facade : le moins cher (2 kg → Colissimo, 10 kg → DHL)', async () => {
  const shipping = new ShippingService(realCarriers());
  assert.equal((await shipping.bestQuote({ weightKg: 2, zip: '75011' })).carrier, 'Colissimo');
  assert.equal((await shipping.bestQuote({ weightKg: 10, zip: '75011' })).carrier, 'DHL');
});

test('Facade : à prix égal, le plus rapide', async () => {
  const best = await new ShippingService([fake('Lent', 10, 4), fake('Rapide', 10, 1)]).bestQuote(parcel);
  assert.equal(best.carrier, 'Rapide');
});

test('Facade : un transporteur en panne est ignoré, aucun → erreur', async () => {
  const best = await new ShippingService([broken, new ColissimoAdapter(new ColissimoApi())]).bestQuote(parcel);
  assert.equal(best.carrier, 'Colissimo');
  await assert.rejects(new ShippingService([broken]).bestQuote(parcel), /Aucun transporteur disponible/);
  await assert.rejects(new ShippingService([]).bestQuote(parcel), /Aucun transporteur disponible/);
});
