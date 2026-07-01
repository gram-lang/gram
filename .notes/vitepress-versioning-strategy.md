# Stratégie de Versionnage de la Documentation sur Codeberg Pages

Puisque Codeberg Pages déploie le contenu d'une branche spécifique (généralement `pages`) et ne permet pas facilement la création de sous-domaines à la volée, la stratégie de gestion de multiples versions de la documentation repose sur la compilation et l'imbrication des dossiers générés au moment du build.

## Le Principe (Composite Deployment)

Le but est de conserver un dépôt Git principal `main` **parfaitement propre**, qui ne contient que la documentation de la version actuelle. Les anciennes versions ne polluent jamais les sources Markdown de la version courante. L'assemblage se fait **uniquement** via un script de déploiement (CI/CD ou local).

### Fonctionnement du Script de Déploiement

Imaginons que nous sommes à la version 2.0 (sur la branche `main`) et que nous voulons garder la documentation de la version 1.0 disponible.

1. **Préparation** : Le script crée un dossier temporaire, par exemple `build_final/`.
2. **Build de l'ancienne version** : 
   - Le script checkout la branche ou le tag de l'ancienne version : `git checkout v1.0`
   - Il compile la documentation avec VitePress, en s'assurant de configurer le paramètre `base` de l'URL sur `/gram/v1.0/` (si le dépôt s'appelle `gram`).
   - Le dossier `dist/` généré est copié dans `build_final/v1.0/`.
3. **Build de la version actuelle** :
   - Le script revient sur la branche actuelle : `git checkout main`
   - Il compile la documentation avec VitePress en configurant le paramètre `base` sur `/gram/`.
   - Le dossier `dist/` généré est copié à la racine de `build_final/`.
4. **Déploiement** : 
   - Le contenu complet du dossier `build_final/` est envoyé (ou *pushé*) vers la branche `pages` de Codeberg.

### Résultat côté VitePress (config.mts)

Dans le `config.mts` de la branche `main`, le menu déroulant des versions (`nav`) se configure simplement avec un lien absolu pointant vers le sous-dossier généré :

```typescript
nav: [
  {
    text: 'v2.0.0', // Version actuelle affichée
    items: [
      { text: 'v2.0.0 (Actuelle)', link: '/' }, 
      { text: 'v1.0.x', link: '/gram/v1.0/' } // Pointeur vers le dossier généré lors du build
    ]
  }
]
```

C'est extrêmement propre, facilement automatisable via un script Bash ou CI, et cela permet de respecter pleinement les contraintes d'hébergement statique de Codeberg Pages.
