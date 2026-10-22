# TP 4 · Patterns créationnels et structuraux

**Architecture Logicielle · M1 INGETIS · parcours Dev**
Travail réalisé en monôme par **Mohamedhen YAYA** · 22 octobre 2026

Notifications (Factory, Builder) et client de transporteurs résilient (Adapter, Decorator, Facade) pour ShopLite.

## Lancer

```bash
npm test      # 14 tests (Node >= 20)
npm start     # démonstration
```

Sortie de la démonstration :

```
[EMAIL → alice@exemple.fr] Bonjour Alice, votre colis de 2 kg part avec Colissimo (9.95 €).
[EMAIL → alice@exemple.fr] Bonjour Alice, votre colis de 10 kg part avec DHL (23.00 €).
[SLACK #logistique] Tarifs mis à jour
```

## Contenu

| Élément | Fichier(s) |
|---|---|
| API des transporteurs fournies (non modifiées) | `tp4/carrierApis.js` |
| Factory Method + registre | `tp4-Yaya_Mohamedhen/notifications/channels.js` |
| Canal Slack ajouté sans modifier `channels.js` | `tp4-Yaya_Mohamedhen/notifications/slack.js` |
| Builder | `tp4-Yaya_Mohamedhen/notifications/MessageBuilder.js` |
| Adapter | `tp4-Yaya_Mohamedhen/shipping/adapters.js` |
| Decorator (retry, cache) | `tp4-Yaya_Mohamedhen/shipping/decorators.js` |
| Facade | `tp4-Yaya_Mohamedhen/shipping/ShippingService.js` |
| Composition et démonstration | `tp4-Yaya_Mohamedhen/main.js` |
| Tests | `tp4-Yaya_Mohamedhen/tp4.test.js` |
| Justification des choix | [PATTERNS.md](tp4-Yaya_Mohamedhen/PATTERNS.md) |
