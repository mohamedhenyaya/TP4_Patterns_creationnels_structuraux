// Adapter : chaque API de transporteur est traduite vers NOTRE contrat unique
//   getQuote({ weightKg, zip }) -> Promise<{ carrier, price (euros, nombre), days }>
// Les API fournies (carrierApis.js) ne sont pas modifiées.

export class ColissimoAdapter {
  constructor(api) {
    this.api = api;
  }

  async getQuote({ weightKg, zip }) {
    const r = this.api.tarif({ poidsGrammes: Math.round(weightKg * 1000), codePostal: zip });
    return { carrier: 'Colissimo', price: r.prixCentimes / 100, days: r.delaiJours };
  }
}

export class DhlAdapter {
  constructor(client) {
    this.client = client;
  }

  async getQuote({ weightKg, zip }) {
    const r = await this.client.getRate(weightKg, zip);
    return { carrier: 'DHL', price: Number(r.amount), days: r.transitDays };
  }
}
