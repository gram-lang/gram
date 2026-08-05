---
title: "@gram-lang/format"
description: "Le formateur de code canonique pour les fichiers .gram, appliquant 13 règles déterministes utilisées par le CLI et les éditeurs."
---

Il s'agit du formateur de code canonique pour les fichiers `.gram`, embarqué à la fois dans la commande CLI `gram format` et dans l'extension VS Code (via le Language Server). Il unifie 13 règles de formatage en une seule passe déterministe.

## `formatGram`

```typescript
function formatGram(source: string, options?: FormatterOptions): string
```

Formate un code source `.gram` selon les 13 règles canoniques du langage.

```typescript
import { formatGram } from '@gram-lang/format';

const formatted = formatGram(`
---
title: 'Crêpes'
---

## Pâte
Mélanger @farine{200g}  et  @lait{200ml}.
`);
```

## `FormatterOptions`

```typescript
interface FormatterOptions {
  tabSize?: number;      // Nombre d'espaces par niveau de tabulation (défaut : 2)
  insertSpaces?: boolean; // Utiliser des espaces au lieu des tabulations (défaut : true)
}
```

## Règles de formatage

`formatGram` applique 13 règles de formatage déterministes :

1. **Frontmatter** : Conserve les délimiteurs de *frontmatter* (`---`) et nettoie les espaces superflus autour des métadonnées.
2. **Titres de section** : Assure un espace unique après `##` pour les titres de section (ex. `## Section`).
3. **Indexation des étapes** : Assure un formatage propre des préfixes d'étapes numérotées (`1. Texte d'étape`).
4. **Blocs d'action** : Normalise les préfixes d'action d'étape (`[Mélanger] ...`).
5. **Jetons d'ingrédients** : Normalise les espaces et la syntaxe des crochets `@ingrédient{qte}`.
6. **Jetons de matériel** : Normalise les espaces et la syntaxe `#matériel{qte}`.
7. **Jetons de minuterie** : Normalise les espaces pour `~minuterie{durée}` et les minuteries passives `~_minuterie{durée}`.
8. **Jetons de température** : Normalise la syntaxe `^temp{valeur}`.
9. **Déclarations et références d'intermédiaires** : Normalise les déclarations `->&pâte` et références `&pâte`.
10. **Syntaxe composite** : Normalise la syntaxe des ingrédients composites `<@parent`.
11. **Quantités décimales** : Normalise les quantités décimales numériques (ex. suppression des zéros inutiles `1.50` -> `1.5`).
12. **Formatage des commentaires** : Assure un espace propre après les sigles de commentaire (`// commentaire`).
13. **Nettoyage des espaces** : Supprime les espaces en fin de ligne et assure un saut de ligne final unique.

## `FormatterChanges`

Retourne des métriques structurées sur les modifications opérées (pratique pour les extensions d'éditeur et le *reporting*) :

```typescript
interface FormatterChanges {
  formatted: string;
  hasChanges: boolean;
  rulesApplied: string[];
}
```
