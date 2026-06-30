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
          { text: 'Ecosystem', link: '/ecosystem/cli' },
          { text: 'Playground', link: '/playground/' }
        ],
        sidebar: [
          {
            text: 'Introduction',
            items: [
              { text: 'What is Gram?', link: '/guide/what-is-gram' },
              { text: 'Getting Started', link: '/guide/getting-started' }
            ]
          },
          {
            text: 'Language Specification',
            items: [
              { text: 'Document Structure', link: '/syntax/document-structure' },
              { text: 'Ingredients', link: '/syntax/ingredients' },
              { text: 'Cookware', link: '/syntax/cookware' },
              { text: 'Times', link: '/syntax/times' },
              { text: 'Temperatures', link: '/syntax/temperatures' },
              { text: 'Relative Quantities', link: '/syntax/relative-quantities' },
              { text: 'Intermediate Variables', link: '/syntax/intermediate-variables' },
              { text: 'Composite Ingredients', link: '/syntax/composite-ingredients' },
              { text: 'Cheatsheet', link: '/syntax/cheatsheet' }
            ]
          },
          {
            text: 'Ecosystem & Tools',
            items: [
              { text: 'CLI', link: '/ecosystem/cli' },
              { text: 'VS Code Extension', link: '/ecosystem/vscode-extension' },
              { text: 'Language Server', link: '/ecosystem/language-server' }
            ]
          },
          {
            text: 'The Engine (Internals)',
            items: [
              { text: 'The Gram Lifecycle', link: '/engine/lifecycle' },
              { text: 'Parsing & AST', link: '/engine/parser' },
              { text: 'Compilation & Structure', link: '/engine/kitchen' },
              { text: 'Semantic Analysis', link: '/engine/analyzer' },
              { text: 'JSON Output', link: '/engine/renderer' }
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
      { icon: { svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Codeberg</title><path d="M11.999.747A11.974 11.974 0 0 0 0 12.75c0 2.254.635 4.465 1.833 6.376L11.837 6.19c.072-.092.251-.092.323 0l4.178 5.402h-2.992l.065.239h3.113l.882 1.138h-3.674l.103.374h3.86l.777 1.003h-4.358l.135.483h4.593l.695.894h-5.038l.165.589h5.326l.609.785h-5.717l.182.65h6.038l.562.727h-6.397l.183.65h6.717A12.003 12.003 0 0 0 24 12.75 11.977 11.977 0 0 0 11.999.747zm3.654 19.104.182.65h5.326c.173-.204.353-.433.513-.65zm.385 1.377.18.65h3.563c.233-.198.485-.428.712-.65zm.383 1.377.182.648h1.203c.356-.204.685-.412 1.042-.648zz"/></svg>' }, link: 'https://codeberg.org/abiwab/gram' }
    ]
  }
})
