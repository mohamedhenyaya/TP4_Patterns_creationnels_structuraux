// Decorator : même interface getQuote(parcel) que l'objet enveloppé, donc composables à volonté.

export class RetryQuote {
  constructor(inner, { attempts = 3 } = {}) {
    this.inner = inner;
    this.attempts = attempts;
  }

  async getQuote(parcel) {
    let lastError;
    for (let i = 1; i <= this.attempts; i++) {
      try {
        return await this.inner.getQuote(parcel);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }
}

export class CachedQuote {
  #entries = new Map();

  constructor(inner, { ttlMs = 60000, now = Date.now } = {}) {
    this.inner = inner;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  async getQuote(parcel) {
    const key = `${parcel.weightKg}|${parcel.zip}`;
    const hit = this.#entries.get(key);
    if (hit && this.now() < hit.expiresAt) return hit.quote;
    const quote = await this.inner.getQuote(parcel); // une erreur n'est jamais mise en cache
    this.#entries.set(key, { quote, expiresAt: this.now() + this.ttlMs });
    return quote;
  }
}
