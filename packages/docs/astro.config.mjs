// @ts-check
import { defineConfig } from 'astro/config';

import starlight from '@astrojs/starlight';
import vue from '@astrojs/vue';

// https://astro.build/config
export default defineConfig({
  devToolbar: {
    enabled: false
  },
  integrations: [
    vue(),
    starlight({
      title: 'Gram',
      customCss: [
        './src/styles/global.css',
      ],
      locales: {
        root: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' }
      },
      head: [
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: '/script.js',
            'data-website-id': 'fa1b1921-1982-4198-bb2b-c30d24f587ce'
          }
        },
        {
          tag: 'script',
          content: `if (typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '/index.html')) {
  var lang = navigator.language || navigator.userLanguage || '';
  if (lang.toLowerCase().startsWith('fr') && !sessionStorage.getItem('lang_redirected')) {
    sessionStorage.setItem('lang_redirected', 'true');
    window.location.replace('/fr/');
  }
}`
        }
      ],
      social: {
        github: 'https://github.com/gram-lang/gram'
      },
      components: {
        // We'll override components here if needed
      }
    })
  ],
  vite: {
    plugins: [
      {
        name: 'force-esnext',
        enforce: 'pre',
        config() {
          return {
            build: { target: 'esnext' },
            esbuild: { target: 'esnext' },
            optimizeDeps: { esbuildOptions: { target: 'esnext' } }
          };
        }
      }
    ]
  }
});
