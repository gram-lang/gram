import { defineConfig } from 'vitepress'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const gramGrammarPath = path.resolve(__dirname, '../../../vscode-extension/syntaxes/gram.tmLanguage.json')
const gramGrammar = JSON.parse(fs.readFileSync(gramGrammarPath, 'utf-8'))

export default defineConfig({
  title: "Gram",
  description: "A smart, data-driven recipe markup language for developers.",
  cleanUrls: true,
  ignoreDeadLinks: true,

  markdown: {
    languages: [
      {
        ...gramGrammar,
        name: 'gram',
      }
    ]
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/what-is-gram' },
          { text: 'Features', link: '/features/cli' },
          { text: 'Playground', link: '/playground/' }
        ],
        sidebar: [
          {
            text: 'Syntax Guide',
            items: [
              { text: 'What is Gram?', link: '/guide/what-is-gram' },
              { text: 'Structure', link: '/guide/structure' },
              { text: 'Ingredients', link: '/guide/ingredients' },
              { text: 'Cookware', link: '/guide/cookware' },
              { text: 'Time & Temperatures', link: '/guide/time-and-temperatures' },
              { text: 'Relative Quantities', link: '/guide/advanced/relative-quantities' },
              { text: 'Intermediate Vars', link: '/guide/advanced/intermediate-vars' },
              { text: 'Composite Ingredients', link: '/guide/advanced/composite-ingredients' },
              { text: 'Cheatsheet', link: '/guide/cheatsheet' }
            ]
          },
          {
            text: 'Core Features',
            items: [
              { text: 'Mass Normalization', link: '/features/mass-normalization' },
              { text: 'Yield Management', link: '/features/yield-management' },
              { text: 'Nutritional Estimation', link: '/features/nutritional-estimation' },
              { text: 'Time & Scheduling', link: '/features/time-and-scheduling' },
              { text: 'Shopping List Logic', link: '/features/shopping-list-logic' },
              { text: 'CLI', link: '/features/cli' },
              { text: 'VS Code Extension', link: '/features/vscode-extension' }
            ]
          },
          {
            text: 'Technical',
            items: [
              { text: 'Parsing Architecture', link: '/technical/parsing-architecture' },
              { text: 'JSON Output', link: '/technical/json-output' },
              { text: 'Ingredient Database', link: '/technical/ingredient-database' },
              { text: 'Options', link: '/technical/options' },
              { text: 'Development Environment', link: '/technical/development-environment' }
            ]
          }
        ]
      }
    },
    fr: {
      label: 'Français',
      lang: 'fr',
      link: '/fr/',
      description: "Un langage de balisage de recettes intelligent et orienté données pour les développeurs.",
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/fr/guide/what-is-gram' },
          { text: 'Fonctionnalités', link: '/fr/features/cli' },
          { text: 'Playground', link: '/playground/' }
        ],
        sidebar: [
          {
            text: 'Guide de Syntaxe',
            items: [
              { text: 'C\'est quoi Gram ?', link: '/fr/guide/what-is-gram' },
              { text: 'Structure', link: '/fr/guide/structure' },
              { text: 'Ingrédients', link: '/fr/guide/ingredients' },
              { text: 'Matériel', link: '/fr/guide/cookware' },
              { text: 'Temps & Températures', link: '/fr/guide/time-and-temperatures' },
              { text: 'Quantités Relatives', link: '/fr/guide/advanced/relative-quantities' },
              { text: 'Variables Intermédiaires', link: '/fr/guide/advanced/intermediate-vars' },
              { text: 'Ingrédients Composites', link: '/fr/guide/advanced/composite-ingredients' },
              { text: 'Antisèche', link: '/fr/guide/cheatsheet' }
            ]
          },
          {
            text: 'Fonctionnalités Clés',
            items: [
              { text: 'Normalisation des Masses', link: '/fr/features/mass-normalization' },
              { text: 'Gestion du Rendement', link: '/fr/features/yield-management' },
              { text: 'Estimation Nutritionnelle', link: '/fr/features/nutritional-estimation' },
              { text: 'Temps & Planification', link: '/fr/features/time-and-scheduling' },
              { text: 'Logique des Courses', link: '/fr/features/shopping-list-logic' },
              { text: 'CLI', link: '/fr/features/cli' },
              { text: 'Extension VS Code', link: '/fr/features/vscode-extension' }
            ]
          },
          {
            text: 'Technique',
            items: [
              { text: 'Architecture du Parser', link: '/fr/technical/parsing-architecture' },
              { text: 'Sortie JSON', link: '/fr/technical/json-output' },
              { text: 'Base de Données', link: '/fr/technical/ingredient-database' },
              { text: 'Options', link: '/fr/technical/options' },
              { text: 'Environnement de Dév', link: '/fr/technical/development-environment' }
            ]
          }
        ]
      }
    }
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://codeberg.org/abiwab/gram' }
    ]
  }
})
