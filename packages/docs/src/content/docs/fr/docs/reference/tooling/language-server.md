---
title: "Serveur de Langage (Language Server)"
---

Le Serveur de Langage Gram (`@gram-lang/language-server`) est le moteur d'intelligence derrière les intégrations dans les éditeurs. Il implémente le standard **Language Server Protocol (LSP)**, ce qui rend possible la fourniture de fonctionnalités d'IDE avancées pour les fichiers Gram sur de multiples éditeurs, et pas seulement VS Code.

## Architecture

Le serveur agit comme un processus en arrière-plan persistant qui analyse vos fichiers `.gram` en utilisant les paquets `@gram-lang/parser` et `@gram-lang/kitchen`. 

**Le flux de travail en temps réel :**
1. **Éditeur** ➔ Envoie les modifications du fichier à chaque frappe au clavier.
2. **Serveur de Langage** ➔ Intercepte les modifications et demande au Compilateur Gram de réévaluer l'AST en mémoire.
3. **Compilateur Gram** ➔ Analyse la nouvelle structure et émet les avertissements, les macros, et les dépendances.
4. **Serveur de Langage** ➔ Traduit ces données en messages LSP standards (Diagnostics, Jetons Sémantiques, Inlay Hints) et les renvoie à l'éditeur.

## Fonctionnalités LSP Supportées

Le Serveur de Langage Gram implémente les capacités standards suivantes :

| Capacité LSP | Implémentation Gram |
|---|---|
| **Diagnostics** | Signalement en temps réel des erreurs de syntaxe et de structure (ex : dépendances circulaires). |
| **Semantic Tokens** | Coloration syntaxique pilotée par l'AST pour les modificateurs, les unités et les ingrédients composites. |
| **Completion** | Autocomplétion intelligente pour les ingrédients, les unités et les variables. |
| **Hover** | Affiche les répartitions nutritionnelles et les conversions volume-masse au survol. |
| **Go to Definition** | Naviguer d'une référence intermédiaire directement vers sa déclaration. |
| **Find References** | Localiser toutes les utilisations d'une variable intermédiaire spécifique. |
| **Rename** | Renommer de manière sûre et atomique les variables intermédiaires. |
| **Code Actions** | Corrections rapides (quick fixes : déclarer des variables manquantes, convertir volume en masse). |
| **Document Formatting**| Nettoie l'espacement, la syntaxe des composites et aligne les en-têtes via `@gram-lang/format` (13 règles canoniques). |
| **Inlay Hints** | Affiche les temps de préparation cumulés en ligne au sein de l'éditeur. |
| **Code Lens** | Injecte des boutons d'action interactifs (comme le calcul des Macros). |
| **Document Symbol** | Remplit la vue Plan (Outline) de l'éditeur pour une navigation structurelle. |
| **Folding Range** | Permet de replier les `## Sections` de la recette et le frontmatter YAML. |
