# Comment Créer une UI Personnalisée (Consommer du JSON)

Si vous construisez une application web moderne (par ex., avec React, Vue, Svelte ou Next.js), vous devriez consommer directement les **données JSON** compilées par Gram et les lier (mapper) à vos propres composants d'interface utilisateur (UI).

Bien que la sortie brute de l'analyseur (parser) soit un Arbre Syntaxique Abstrait (AST), les paquets `@gram-lang/kitchen` et `@gram-lang/analyzer` transforment cet AST en un objet JSON hautement structuré et prêt à être affiché. Ce guide vous montre comment extraire programmatiquement ces données JSON et comprendre leur structure pour que vous puissiez construire tout ce que vous voulez.

## 1. Récupérer les Données JSON

Gram est conçu pour s'exécuter n'importe où (Node.js, Edge, ou directement dans le navigateur). Pour obtenir la représentation JSON entièrement enrichie d'une recette, vous composez les trois paquets principaux :

```typescript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';
import { analyze } from '@gram-lang/analyzer';

function getRecipeData(sourceCode: string) {
  // 1. Parser le texte en arbre syntaxique
  const ast = getAST(sourceCode);
  
  // 2. Compiler en sections structurées
  const compiled = compile(ast);

  // 3. Enrichir avec les mathématiques culinaires (rendements, pourcentages, mise à l'échelle)
  const analyzed = analyze(compiled, { 
    db: myDatabase // optionnel : votre base de données d'ingrédients chargée
  });

  return analyzed.result;
}
```

> **Astuce** : Si vous vous exécutez exclusivement dans un environnement Node.js (ex : un outil CLI ou un serveur Next.js), vous pouvez utiliser l'utilitaire `runPipeline(filePath)` du paquet `@gram-lang/cli` qui encapsule cette logique et s'occupe de la lecture du fichier pour vous.

## 2. Comprendre la Structure du JSON

L'objet JSON retourné représente la recette complète et structurée. Il contient tout ce dont vous avez besoin pour construire une interface utilisateur.

Voici les champs les plus importants dans l'objet racine :
- `title` *(string)* : Le nom de la recette (issu du `# Titre`).
- `meta` *(object)* : Paires clé-valeur pour les métadonnées (ex : `author`, `yield`).
- `shopping_list` *(array)* : Une liste agrégée de tous les ingrédients de toutes les sections.
- `sections` *(array)* : Les instructions elles-mêmes, découpées par section de recette.

### À l'intérieur d'une Section

Chaque `section` dans le tableau `sections` possède ses propres `ingredients`, `cookware` (matériel), et `steps` (étapes).

```json
{
  "title": "Pâte",
  "ingredients": [ ... ],
  "cookware": [ ... ],
  "steps": [
    {
      "type": "step",
      "action": "Mélanger",
      "content": [
        "La ",
        {
          "id": "farine",
          "_usageId": "1",
          "qty": 500,
          "unit": "g",
          "normalizedMass": 500
        },
        " et l'",
        {
          "id": "eau",
          "_usageId": "2",
          "qty": 350,
          "unit": "ml"
        },
        "."
      ],
      "timings": {
        "start": 0,
        "end": 2,
        "activeDuration": 2
      }
    }
  ]
}
```

## 3. Logique de Rendu

Parce que les données JSON de Gram sont très structurées, construire une UI n'est qu'une question de boucles ou de fonctions `map` dans votre framework frontend.

### Exemple : Rendu des Étapes en React

Voici un exemple conceptuel de la façon dont vous pourriez faire le rendu du tableau `steps` en React :

```tsx
function RecipeStep({ step }) {
  // Si c'est un simple nœud de commentaire
  if (step.type === 'comment') {
    return <p className="text-gray-500 italic">{step.value}</p>;
  }

  // Si c'est une étape d'instruction standard
  if (step.type === 'step') {
    return (
      <li>
        {step.action && <strong>[{step.action}] </strong>}
        {step.content.map((token, i) => (
          <StepToken key={i} token={token} />
        ))}
      </li>
    );
  }
}

// Un composant polymorphe pour afficher les tokens en ligne
function StepToken({ token, cookwareRegistry }) {
  // 1. Les chaînes de caractères (strings) sont du simple texte brut
  if (typeof token === 'string') {
    return <span>{token}</span>;
  }

  // 2. Les Ingrédients et le Matériel sont des objets optimisés sans champ 'type', mais avec un 'id'.
  // On déduit le type en vérifiant si l'ID existe dans notre registre de matériel.
  if (!token.type && token.id) {
    const isCookware = !!cookwareRegistry[token.id];
    
    if (isCookware) {
      return <span className="text-blue-600 font-bold">{token.id}</span>;
    } else {
      return <span className="text-green-600 font-bold">{token.id} ({token.qty}{token.unit})</span>;
    }
  }

  // 3. Les autres tokens (minuteurs, températures) ont des champs 'type' explicites
  switch (token.type) {
    case 'timer':
      return <span className="bg-yellow-100 px-1 rounded">{token.quantity?.value}{token.unit}</span>;
    case 'temperature':
      return <span className="text-red-600">{token.quantity?.value}°{token.unit}</span>;
    default:
      return null;
  }
}
```

En associant la propriété `type` à vos propres composants, vous avez un **contrôle total** sur le design, l'interactivité et l'accessibilité de votre application de recettes !
