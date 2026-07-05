---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Gram"
  text: "Codez votre livre de recettes."
  tagline: Un langage de balisage pensé pour la logique culinaire avancée. Écrivez votre recette une seule fois, et laissez le moteur Gram se charger des calculs, de la mise à l'échelle et de l'extraction des données pour vous.
  image:
    light: /logo-gram-light.svg
    dark: /logo-gram-dark.svg
    alt: Logo Gram
  actions:
    - theme: brand
      text: Démarrer
      link: /fr/explanation/philosophy
    - theme: alt
      text: Tester le Playground
      link: /play/
    - theme: alt
      text: Codeberg
      link: https://codeberg.org/abiwab/gram

features:
  - icon:
      src: /cooking-pot.svg
    title: Recettes Relationnelles
    details: Traitez vos recettes comme du code. Gérez des recettes complexes en définissant des variables, en liant dynamiquement les proportions d'ingrédients, et en générant des plannings de cuisine intelligents à partir de simples tags.
  - icon:
      src: /brain.svg
    title: Intelligence par la Data
    details: Connectez vos fichiers à une base de données locale pour convertir automatiquement les volumes en masse, suivre les rendements physiques et estimer les macros nutritionnelles.
  - icon:
      src: /terminal-window.svg
    title: Outils pour Développeurs
    details: Gardez vos recettes dans des fichiers lisibles par Git. Profitez d'un Language Server (LSP) offrant autocomplétion, diagnostics en temps réel et prévisualisation dans votre éditeur favori.
---
