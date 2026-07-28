// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  devToolbar: {
    enabled: false
  },
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
