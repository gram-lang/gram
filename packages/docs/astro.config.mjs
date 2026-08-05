// @ts-check
import { defineConfig } from 'astro/config';

import starlight from '@astrojs/starlight';
import starlightThemeNova from 'starlight-theme-nova';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import { remarkMermaid } from './src/plugins/remark-mermaid.ts';
import gramGrammar from '@gram-lang/parser/textmate';
import { UMAMI_WEBSITE_ID, UMAMI_SCRIPT_SRC, FR_REDIRECT_SCRIPT } from './src/lib/head-scripts.ts';

const isProd = process.env.NODE_ENV === 'production';
const SITE_URL = 'https://gram-lang.org';

// https://astro.build/config
export default defineConfig({
  site: 'https://gram-lang.org',
  devToolbar: {
    enabled: false
  },
  markdown: {
    processor: unified({ remarkPlugins: [remarkMermaid] }),
    shikiConfig: {
      langs: [{ ...gramGrammar, name: 'gram' }]
    }
  },
  integrations: [
    vue(),
    starlight({
      plugins: [starlightThemeNova()],
      title: 'Gram',
      disable404Route: true,
      customCss: [
        './src/styles/global.css',
      ],
      components: {
        Footer: './src/components/Footer.astro',
        SiteTitle: './src/components/SiteTitle.astro',
        ThemeSelect: './src/components/ThemeSelect.astro'
      },
      locales: {
        root: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' }
      },
      sidebar: [
        {
          label: 'Introduction',
          collapsed: false,
          items: [
            { label: 'What is Gram?', translations: { fr: "C'est quoi Gram ?" }, slug: 'docs/explanation/philosophy' },
            { label: 'Getting Started', translations: { fr: 'Pour commencer' }, slug: 'docs/tutorials/getting-started' },
            { label: 'Your First Recipe', translations: { fr: 'Votre première recette' }, slug: 'docs/tutorials/first-recipe' }
          ]
        },
        {
          label: 'How-To Guides',
          translations: { fr: 'Guides pratiques' },
          collapsed: false,
          items: [
            { label: 'Manage Database', translations: { fr: 'Gérer la base de données' }, slug: 'docs/how-to/manage-database' },
            { label: 'Scale Recipes Dynamically', translations: { fr: "Mise à l'échelle dynamique" }, slug: 'docs/how-to/scale-recipes' },
            { label: 'Generate Shopping List', translations: { fr: 'Générer la liste de courses' }, slug: 'docs/how-to/weekly-shopping-list' },
            { label: 'How to Build a Custom UI', translations: { fr: 'Créer une UI personnalisée' }, slug: 'docs/how-to/build-custom-ui' }
          ]
        },
        {
          label: 'Language Reference',
          translations: { fr: 'Référence du langage' },
          collapsed: false,
          items: [
            { label: 'Document Structure', translations: { fr: 'Structure du Document' }, slug: 'docs/reference/syntax/document-structure' },
            { label: 'Ingredients', translations: { fr: 'Ingrédients' }, slug: 'docs/reference/syntax/ingredients' },
            { label: 'Cookware', translations: { fr: 'Matériel' }, slug: 'docs/reference/syntax/cookware' },
            { label: 'Times', translations: { fr: 'Temps' }, slug: 'docs/reference/syntax/times' },
            { label: 'Temperatures', translations: { fr: 'Températures' }, slug: 'docs/reference/syntax/temperatures' },
            { label: 'Intermediate Variables', translations: { fr: 'Variables Intermédiaires' }, slug: 'docs/reference/syntax/intermediate-variables' },
            { label: 'Relative Quantities', translations: { fr: 'Quantités Relatives' }, slug: 'docs/reference/syntax/relative-quantities' },
            { label: 'Composite Ingredients', translations: { fr: 'Ingrédients Composites' }, slug: 'docs/reference/syntax/composite-ingredients' },
            { label: 'Cheatsheet', translations: { fr: 'Antisèche' }, slug: 'docs/reference/syntax/cheatsheet' },
            { label: 'Writing Gram Programmatically', translations: { fr: 'Génération Automatisée de Gram' }, slug: 'docs/reference/syntax/ai-generation-notes' }
          ]
        },
        {
          label: 'Tooling Reference',
          translations: { fr: 'Référence des outils' },
          collapsed: false,
          items: [
            { label: 'CLI Commands', translations: { fr: 'Commandes CLI' }, slug: 'docs/reference/tooling/cli' },
            { label: 'VS Code Extension', translations: { fr: 'Extension VS Code' }, slug: 'docs/reference/tooling/vscode-extension' },
            { label: 'Language Server', slug: 'docs/reference/tooling/language-server' }
          ]
        },
        {
          label: 'API Reference',
          translations: { fr: 'Référence API' },
          collapsed: true,
          items: [
            { label: 'Overview', translations: { fr: "Vue d'ensemble" }, slug: 'docs/reference/api' },
            { label: '@gram-lang/parser', slug: 'docs/reference/api/parser' },
            { label: '@gram-lang/kitchen', slug: 'docs/reference/api/kitchen' },
            { label: '@gram-lang/analyzer', slug: 'docs/reference/api/analyzer' },
            { label: '@gram-lang/renderer', slug: 'docs/reference/api/renderer' },
            { label: '@gram-lang/format', slug: 'docs/reference/api/format' },
            { label: '@gram-lang/i18n', slug: 'docs/reference/api/i18n' },
            { label: 'Data Formats', translations: { fr: 'Formats de Données' }, slug: 'docs/reference/api/data-formats' },
            { label: 'Warnings', translations: { fr: 'Avertissements' }, slug: 'docs/reference/api/warnings' }
          ]
        },
        {
          label: 'Gram Engine',
          translations: { fr: 'Moteur Gram' },
          collapsed: true,
          items: [
            { label: 'The Gram Lifecycle', translations: { fr: 'Cycle de vie' }, slug: 'docs/explanation/engine/lifecycle' },
            { label: 'Parsing & AST', slug: 'docs/explanation/engine/parser' },
            { label: 'Compilation & Structure', translations: { fr: 'Compilation & Structure' }, slug: 'docs/explanation/engine/kitchen' },
            { label: 'Semantic Analysis', translations: { fr: 'Analyse Sémantique' }, slug: 'docs/explanation/engine/analyzer' },
            { label: 'Rendering & Output', translations: { fr: 'Rendu & Sortie' }, slug: 'docs/explanation/engine/renderer' }
          ]
        },
        {
          label: 'Deep Dives',
          translations: { fr: 'Analyses approfondies' },
          collapsed: true,
          items: [
            { label: 'ALAP Scheduling', translations: { fr: 'Ordonnancement ALAP' }, slug: 'docs/explanation/alap-scheduling' },
            { label: 'Mass & Yield', translations: { fr: 'Masse & Rendement' }, slug: 'docs/explanation/mass-and-yield' },
            { label: 'Nutrition', slug: 'docs/explanation/nutrition' },
            { label: 'Shopping Lists', translations: { fr: 'Liste de courses' }, slug: 'docs/explanation/shopping-list-aggregation' },
            { label: 'Scaling', translations: { fr: "Mise à l'échelle" }, slug: 'docs/explanation/scaling' }
          ]
        },
        { label: 'Changelog', translations: { fr: 'Changelog' }, slug: 'docs/changelog' }
      ],
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: `${SITE_URL}/gram-social-wide.png`
          }
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:width',
            content: '1200'
          }
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:height',
            content: '630'
          }
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:image',
            content: `${SITE_URL}/gram-social-wide.png`
          }
        },
        {
          tag: 'script',
          attrs: {
            src: 'https://unpkg.com/@phosphor-icons/web'
          }
        },
        ...(isProd ? [{
          tag: /** @type {'script'} */ ('script'),
          attrs: {
            defer: true,
            src: UMAMI_SCRIPT_SRC,
            'data-website-id': UMAMI_WEBSITE_ID
          }
        }] : []),
        {
          tag: 'script',
          content: FR_REDIRECT_SCRIPT
        }
      ],
      social: [
        {
          label: 'Forgejo (Primary repository)',
          icon: 'seti:git',
          href: 'https://git.gram-lang.org/gram-lang/gram'
        },
        {
          label: 'Codeberg Mirror',
          icon: 'codeberg',
          href: 'https://codeberg.org/gram-lang/gram'
        },
        {
          label: 'GitHub Mirror',
          icon: 'github',
          href: 'https://github.com/gram-lang/gram'
        }
      ]
    }),
    mdx(),
    {
      name: 'override-shiki-themes',
      hooks: {
        'astro:config:setup': ({ updateConfig }) => {
          updateConfig({
            markdown: {
              shikiConfig: {
                themes: {
                  light: 'github-light',
                  dark: 'github-dark'
                }
              }
            }
          });
        }
      }
    }
  ],
  vite: {
    build: {
      target: 'esnext'
    },
    esbuild: {
      target: 'esnext'
    },
    optimizeDeps: {
      rolldownOptions: {
        transform: {
          target: 'esnext'
        }
      }
    }
  }
});
