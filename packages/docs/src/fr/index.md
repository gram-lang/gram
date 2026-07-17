---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Gram"
  text: "Codez vos recettes."
  tagline: Un langage de balisage pensé pour la cuisine de précision.
  image:
    light: /logo-gram-light.svg
    dark: /logo-gram-dark.svg
    alt: Logo Gram
  actions:
    - theme: brand
      text: C'est quoi Gram ?
      link: /fr/explanation/philosophy
    - theme: alt
      text: Tester le Playground
      link: /fr/play

features:
  - icon:
      src: /cooking-pot.svg
    title: Recettes Dynamiques
    details: Traitez vos recettes comme du code. Gérez des recettes complexes en définissant des variables, en liant les quantités d'ingrédients entre elles, et en générant des plannings de cuisine intelligents à partir de simples tags.
  - icon:
      src: /brain.svg
    title: Base de Données Intégrée
    details: Connectez vos fichiers à une base de données locale pour convertir automatiquement les volumes en masse, calculer les poids bruts et nets, et estimer les valeurs nutritionnelles.
  - icon:
      src: /terminal-window.svg
    title: Outils pour Développeurs
    details: Gardez vos recettes dans des fichiers lisibles par Git. Profitez d'un Language Server (LSP) offrant autocomplétion, diagnostics en temps réel et prévisualisation dans votre éditeur favori.
---
