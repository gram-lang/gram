# Pour commencer

Ce guide va vous aider à installer l'écosystème Gram et à compiler votre première recette.

## 1. Installation

Gram est un projet open-source. Pour commencer à utiliser le CLI, clonez le dépôt et construisez-le localement. [Bun](https://bun.sh/) est utilisé comme gestionnaire de paquets et moteur d'exécution (runtime).

1. Clonez le dépôt :
   ```bash
   git clone https://codeberg.org/abiwab/gram.git
   cd gram
   ```
2. Installez toutes les dépendances du workspace :
   ```bash
   bun install
   ```
3. Liez le CLI globalement :
   ```bash
   cd packages/cli
   bun link
   ```

> [!NOTE]
> La commande `bun link` enregistre l'exécutable `gram` de manière globale. Assurez-vous que votre dossier `~/.bun/bin` figure bien dans le `PATH` de votre système.

## 2. Configuration de l'éditeur

Étant donné que Gram traite les recettes comme du code, avoir le bon éditeur fait une énorme différence.

::: info Extension VS Code Gram
Il est fortement recommandé d'installer l'**Extension VS Code Gram**. Elle vous offre :
- La coloration syntaxique
- L'autocomplétion
- Des diagnostics en ligne et la vérification des erreurs
- Un retour d'information du compilateur en temps réel
:::

Actuellement, l'extension n'est pas disponible sur le Marketplace VS Code, mais vous pouvez la construire et l'installer localement à partir du dépôt source que vous venez de cloner :

```bash
# 1. Naviguez vers le dossier de l'extension (depuis la racine du dépôt)
cd packages/vscode-extension

# 2. Packagez l'extension (cela génère un fichier .vsix)
bun run package

# 3. Installez le paquet dans VS Code
code --install-extension gram-vscode-extension-*.vsix
```

::: details Alternative : Lien symbolique pour le développement
Pour des besoins de développement, vous pouvez créer un lien symbolique de l'extension directement vers le dossier des extensions locales de VS Code, plutôt que de la packager.

**Linux / macOS** :
```bash
ln -s $(pwd) ~/.vscode/extensions/gram-vscode-extension
```

**Windows (PowerShell)** :
```powershell
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.vscode\extensions\gram-vscode-extension" -Target $PWD
```
:::

## 3. Initialiser un Projet

Avant d'écrire la moindre recette, il est fortement conseillé d'initialiser un espace de travail (workspace) Gram. Lancez cette commande dans un **nouveau dossier** :

```bash
gram init
```

Cette commande va créer un répertoire `.gram/` contenant un fichier de configuration et une base de données de départ.

::: tip Configuration Interactive
Le CLI vous posera quelques questions pour configurer votre fournisseur d'IA (qui servira plus tard pour des fonctionnalités avancées comme l'enrichissement de la base de données ou l'import de recettes). Vous n'en avez pas besoin pour votre première recette ! N'hésitez pas à appuyer simplement sur `Entrée` pour ignorer ces étapes ou accepter les choix par défaut pour le moment.
:::

## 4. Écrire votre première recette

C'est parti pour quelques pancakes !

Créez un nouveau fichier nommé `pancakes.gram`, ouvrez-le dans l'éditeur, et ajoutez-y la recette de base suivante :

```gram [pancakes.gram]
---
title: Pancakes
portions: 2
---

## Appareil ->&appareil

Dans un #bol moyen{}, mélanger la @farine{160 g}, la @levure chimique{1 c.à.c}, le @sucre{1 c.à.s} et le @sel{1/4 c.à.c}. ->&mélange sec{}

Au &mélange sec{}, ajouter le @lait ribot{1 tasse}, l'@œuf{1} et l'@extrait de vanille{1/2 c.à.c}.

## Cuisson

Verser l'&appareil sur une #plaque de cuisson{} à °{feu moyen} et cuire pendant ~{2 min}.
```

## 5. Compiler la Recette

Il est temps de voir le compilateur en action !

Lancez la commande suivante dans le terminal pour compiler la recette vers un format JSON structuré :

```bash
gram build pancakes.gram
```

Cette commande va parser la recette et produire sa représentation JSON structurée. Par défaut, elle l'affiche dans la console, mais vous pouvez la sauvegarder dans un fichier :

```bash
gram build pancakes.gram -o pancakes.json
```

Bien que la sortie JSON soit incroyablement utile pour construire des applications autour de Gram, ce n'est pas le format le plus lisible pour des humains !

Pour voir votre recette s'afficher directement et élégamment dans votre terminal, vous pouvez utiliser la commande `view` :

```bash
gram view pancakes.gram
```

Alternativement, pour lui donner vie avec une interface visuelle entièrement formatée, il est très recommandé d'ouvrir la recette à l'aide de l'**Extension VS Code** ou via le **[Playground Web](/play/)**.

::: tip Essayez le playground
Si vous ne voulez encore rien installer, vous pouvez tester Gram directement sur le web via le [Playground](/play/).
:::

## Étapes Suivantes

Maintenant que vous avez écrit votre première recette, il est temps de plonger un peu plus dans la syntaxe :
- En savoir plus sur la [Structure du Document](../reference/syntax/document-structure.md)
- Apprendre comment déclarer des [Ingrédients](../reference/syntax/ingredients.md)
