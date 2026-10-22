// Builder : on construit le message pas à pas, la validation a lieu une seule fois dans build().
const PRIORITIES = ['basse', 'normale', 'haute'];

export class MessageBuilder {
  #to = null;
  #template = null;
  #vars = new Map();
  #priority = 'normale';

  to(recipient) {
    this.#to = recipient;
    return this;
  }

  template(text) {
    this.#template = text;
    return this;
  }

  with(name, value) {
    this.#vars.set(name, value);
    return this;
  }

  priority(level) {
    this.#priority = level;
    return this;
  }

  build() {
    if (!this.#to) throw new Error('Destinataire obligatoire');
    if (!this.#template) throw new Error('Gabarit obligatoire');
    if (!PRIORITIES.includes(this.#priority)) throw new Error(`Priorité invalide : ${this.#priority}`);
    const body = this.#template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      if (!this.#vars.has(name)) throw new Error(`Variable manquante : ${name}`);
      return String(this.#vars.get(name));
    });
    return Object.freeze({ to: this.#to, body, priority: this.#priority });
  }
}
