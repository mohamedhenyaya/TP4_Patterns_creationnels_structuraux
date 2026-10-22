// Composition et démonstration : node seance4-patterns/tp4-Yaya_Mohamedhen/main.js
import { ColissimoApi, DhlClient } from '../tp4/carrierApis.js';
import { createChannel } from './notifications/channels.js';
import './notifications/slack.js';
import { MessageBuilder } from './notifications/MessageBuilder.js';
import { ColissimoAdapter, DhlAdapter } from './shipping/adapters.js';
import { CachedQuote, RetryQuote } from './shipping/decorators.js';
import { ShippingService } from './shipping/ShippingService.js';

const shipping = new ShippingService([
  new CachedQuote(new ColissimoAdapter(new ColissimoApi())),
  // DHL tombe en panne au premier appel : le retry l'absorbe, le cache évite de le rappeler
  new CachedQuote(new RetryQuote(new DhlAdapter(new DhlClient({ failFirst: 1 })))),
]);

const email = createChannel('email');
for (const weightKg of [2, 10]) {
  const best = await shipping.bestQuote({ weightKg, zip: '75011' });
  const message = new MessageBuilder()
    .to('alice@exemple.fr')
    .template('Bonjour {{nom}}, votre colis de {{poids}} kg part avec {{transporteur}} ({{prix}} €).')
    .with('nom', 'Alice')
    .with('poids', weightKg)
    .with('transporteur', best.carrier)
    .with('prix', best.price.toFixed(2))
    .build();
  console.log(email.send(message));
}

console.log(createChannel('slack').send({ to: 'logistique', body: 'Tarifs mis à jour', priority: 'normale' }));
