# Best Of Amis — frontend public

Ce dossier est safe pour un dépôt GitHub public : il contient uniquement le frontend.

Il ne doit jamais contenir :

- clips vidéo ;
- codes amis / créateur réels ;
- mot de passe admin ;
- `data/store.json` ;
- serveur privé qui lit ou modifie tes fichiers locaux.

## Fonctionnement

Le site public affiche l’interface et appelle ton API privée. Les vidéos restent sur ta machine, côté serveur privé.

Conséquence importante : si ton PC / serveur privé est éteint, le site GitHub peut s’ouvrir, mais il ne pourra pas afficher les clips.

## Configuration de l’API

Dans `config.js`, tu peux mettre l’URL publique de ton API privée :

```js
window.BESTOF_AMIS_CONFIG = {
  apiBase: "https://ton-api.example.com",
  siteName: "Best Of Amis"
};
```

Cette URL est publique si tu la commits. Ce n’est pas un mot de passe, mais elle indique où contacter ton serveur. Les visiteurs auront quand même besoin d’un code ami ou créateur.

Si `apiBase` reste vide, le visiteur devra saisir l’URL du serveur privé dans la page.

Si le site est publié en HTTPS avec GitHub Pages, l’API doit aussi être accessible en HTTPS. Un navigateur bloque généralement un appel HTTPS vers une API HTTP.

## Avant de push sur GitHub

Lance :

```bash
npm run preflight
```

Le script bloque si un clip, un fichier d’état privé ou un vrai code semble présent dans le dossier.

## Hébergement

Pour GitHub Pages, publie ce dossier à la racine du dépôt. `index.html` est déjà à la racine.
