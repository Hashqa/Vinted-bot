# Vinted Discord BOT

Un bot Discord pour Vinted, qui envoie un message lorsqu'une nouvelle annonce est publiée (selon certains critères).

## Distrobot.fr

Bien que le bot open source fonctionne parfaitement et soit très rapide, sa configuration et son installation peut être laborieuse. C'est pour cela que nous vous proposons également notre service https://distrobot.fr :

|                                             | **Bot open source** | **Distrobot** |
|---------------------------------------------|---------------------|---------------|
| Prix                                          | Gratuit                   |  à partir de 9.90€/mois             |
| Mises à jour régulières                     | ✅                   | ✅             |
| Recherches avancées                         | ✅                   | ✅             |
| Vitesse de synchronisation                  | 15s                 | < 5s            |
| En ligne 24/24 7/7                          |  ❌  (sauf VPS payant)                | ✅             |
| Utilisation de proxies (pour + de rapidité) |   ❌                  | ✅             |
| Configuration en 3 clics                    |   ❌                  | ✅             |
| Salons avec conseils de professionnels      |   ❌                  | ✅             |
| Soutien du projet                           |  ❌                   | ✅             |

[![banner](./banner.png)](https://distrobot.fr)

## Abonnez-vous...

Pour s'abonner, entrez n'importe quelle URL Vinted. Le bot déterminera automatiquement les filtres à appliquer aux résultats.

![abo](./examples/abonner.png)

### Créer un filtre par marque (avec son propre salon)

`/filtre marque:Nike prix_max:5 taille:M` crée automatiquement un nouveau salon Discord (ex: `#nike-m-5e`) qui ne recevra que les articles Nike, en taille M, à 5€ ou moins. Le prix est vérifié précisément sur chaque article (pas juste sur la recherche Vinted), et la taille est comparée exactement à celle indiquée sur l'annonce.

Vous pouvez créer autant de filtres que vous voulez, chacun dans son salon dédié :

* `/filtre marque:Nike prix_max:5 taille:M`
* `/filtre marque:Ralph Lauren prix_max:15`
* `/filtre marque:Adidas prix_max:10 mots_cles:jogging`

Chaque filtre a un ID visible via `/abonnements`, à utiliser avec `/désabonner` pour l'arrêter (le salon Discord créé n'est pas supprimé automatiquement, vous pouvez le faire manuellement).

Pour des critères que `/filtre` ne couvre pas (catégorie précise, état de l'article...), `/abonner url:<recherche construite sur vinted.fr> channel:#salon` reste disponible — dans ce cas il faut créer et choisir le salon vous-même.

**Important** : pour que `/filtre` puisse créer des salons, le rôle du bot doit avoir la permission **Gérer les salons** sur votre serveur Discord.

## ...et recevez vos notifications !

![notif](./examples/notif.png)

## Installation

**Je maintiens bénévolement ce bot sur mon temps libre. Pour supporter ce projet, n'hésitez pas à [faire un don](https://paypal.com/andr0z). Si besoin, je suis également disponible pour aider pour l'installation sur [Twitter](https://twitter.com/androz2091) si besoin.**

Prérequis :

* Node.js
* NPM

Installation :

* Installer les dépendances avec `npm install`
* Renommer le fichier `config.sample.json` en `config.json`
* Lancer avec `node index.js`
