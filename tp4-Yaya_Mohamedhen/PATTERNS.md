# PATTERNS — TP 4 · monôme Mohamedhen YAYA · parcours Dev

## Tableau des patterns

| Pattern | Problème résolu dans ShopLite | Alternative écartée | Pourquoi écartée |
|---|---|---|---|
| **Factory Method + registre** (`createChannel`, `registerChannel`) | Le code métier doit prévenir un client par e-mail, SMS ou push à partir d'un simple nom de canal stocké dans ses préférences, sans connaître les classes concrètes. Slack (équipe logistique) s'ajoute dans `slack.js` **sans toucher** à `channels.js` (OCP). | Un `switch (type)` dans une fonction `send()` | Chaque nouveau canal obligerait à rouvrir et retester un fichier qui fonctionne ; le `switch` grossit à chaque ajout et devient un point de conflit entre équipes. |
| **Builder** (`MessageBuilder`) | Un message a des champs obligatoires (destinataire, gabarit), un facultatif (priorité) et un nombre variable de variables `{{…}}`. Le builder les reçoit dans n'importe quel ordre et valide **une seule fois** dans `build()`, puis rend un objet gelé. | Un constructeur `new Message(to, template, vars, priority)` | Paramètres positionnels faciles à inverser, valeurs par défaut pénibles, et un objet partiellement construit pourrait circuler sans être validé. |
| **Adapter** (`ColissimoAdapter`, `DhlAdapter`) | Colissimo (synchrone, grammes, centimes, `delaiJours`) et DHL (asynchrone, kilos, montant en texte, `transitDays`) ont des API incompatibles que nous ne pouvons pas modifier. Les adaptateurs les ramènent à **notre** contrat `getQuote({ weightKg, zip }) → { carrier, price, days }`. | Des `if (carrier === 'DHL')` avec conversions dans `ShippingService` | La façade connaîtrait le format de chaque transporteur : ajouter Chronopost la ferait modifier, et les conversions (grammes, centimes, texte) seraient mélangées à la logique de choix. |
| **Decorator** (`RetryQuote`, `CachedQuote`) | DHL tombe parfois en panne (503) et chaque appel coûte du temps. On ajoute la nouvelle tentative et le cache **autour** de n'importe quel transporteur, sans modifier les adaptateurs, et on les combine à volonté car ils ont la même interface `getQuote`. | Héritage (`RetryDhlAdapter extends DhlAdapter`, `CachedRetryDhlAdapter`…) | Explosion combinatoire : une sous-classe par transporteur et par combinaison de comportements ; impossible de changer l'ordre sans écrire une nouvelle classe. |
| **Facade** (`ShippingService.bestQuote`) | Le reste de l'application veut seulement « le meilleur tarif ». La façade cache l'interrogation en parallèle, l'ignorance des transporteurs en panne (`Promise.allSettled`) et la règle de choix (moins cher, puis plus rapide). | Laisser chaque appelant (checkout, back-office…) interroger les transporteurs lui-même | Logique dupliquée, gestion des pannes oubliée dans un des appelants, et chaque appelant dépendrait de tous les transporteurs. |

## Pourquoi le cache enveloppe le retry, et pas l'inverse

Composition retenue : `new CachedQuote(new RetryQuote(new DhlAdapter(client)))`.

- **Cache(Retry(dhl))** : le cache ne voit que le résultat **final** du retry. Si DHL échoue puis répond, c'est le devis valide qui est mémorisé ; si toutes les tentatives échouent, l'erreur remonte et **rien n'est mis en cache**, donc le prochain appel retentera. Et quand le devis est en cache, on ne déclenche aucune tentative réseau.
- **Retry(Cache(dhl))** : le retry réessaie *le cache*. Une panne traverse le cache à chaque tentative, ce qui n'apporte rien. Surtout, si le cache mémorisait les réponses telles quelles (y compris une erreur ou une réponse dégradée), on risquerait de **mettre en cache une panne** et de la resservir pendant tout le TTL alors que DHL est revenu.

En résumé : le comportement le plus coûteux à éviter (l'appel réseau) est court-circuité le plus à l'extérieur, et seul un résultat validé par les couches internes est mémorisé.

## Choix complémentaires

- `RetryQuote` n'enveloppe pas Colissimo dans `main.js` : son unique erreur (« Code postal invalide ») est une erreur de saisie, réessayer ne changerait rien. Un retry n'a de sens que sur une erreur transitoire.
- `CachedQuote` reçoit `now` en paramètre : l'expiration se teste en avançant une horloge factice, sans `setTimeout`.
- `registerChannel` refuse toute classe qui n'hérite pas de `Channel` : un canal enregistré a forcément une méthode `send` au bon contrat.
