import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  tsconfig: '../../tsconfig.build.json',
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
})
