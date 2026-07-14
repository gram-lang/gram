---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Gram"
  text: "Code your cookbook."
  tagline: A plain-text recipe language built for precision cooking.
  image:
    light: /logo-gram-light.svg
    dark: /logo-gram-dark.svg
    alt: Gram Logo
  actions:
    - theme: brand
      text: Get Started
      link: /explanation/philosophy
    - theme: alt
      text: Try the Playground
      link: /play/

features:
  - icon:
      src: /cooking-pot.svg
    title: Dynamic Recipes
    details: Treat recipes like code. Easily manage complex recipes by defining variables, linking ingredient quantities together, and generating smart cooking schedules from simple tags.
  - icon:
      src: /brain.svg
    title: Integrated Database
    details: Connect your files to a local database to automatically convert volumes to mass, calculate gross and net weights, and estimate nutritional values.
  - icon:
      src: /terminal-window.svg
    title: Developer First Tooling
    details: Keep your cookbook in git-friendly files. Enjoy real-time diagnostics, autocomplete, and live previews in your favorite editor via our Language Server.
---
