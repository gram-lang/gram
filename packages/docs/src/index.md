---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Gram"
  text: "Code your cookbook."
  tagline: A plain-text recipe language built for advanced culinary logic. Write your recipe once, and let the Gram engine handle the math, the scaling, and the data extraction for you.
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
      link: /playground/
    - theme: alt
      text: Codeberg
      link: https://codeberg.org/abiwab/gram

features:
  - icon: 🧩
    title: Relational Recipes
    details: Treat recipes like code. Easily manage complex recipes by defining variables, linking ingredient proportions dynamically, and generating smart cooking schedules from simple tags.
  - icon: 📊
    title: Database-Driven Intelligence
    details: Connect your files to a local database to automatically convert volumes to mass, track physical yields, and estimate nutritional macros.
  - icon: 🛠️
    title: Developer First Tooling
    details: Keep your cookbook in git-friendly files. Enjoy real-time diagnostics, autocomplete, and live previews in your favorite editor via our Language Server.
---
