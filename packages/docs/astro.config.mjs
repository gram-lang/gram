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
        config(config) {
          if (config.build) config.build.target = 'esnext';
          if (config.esbuild) config.esbuild.target = 'esnext';
          if (config.optimizeDeps?.esbuildOptions) config.optimizeDeps.esbuildOptions.target = 'esnext';
        }
      }
    ]
  }
});
