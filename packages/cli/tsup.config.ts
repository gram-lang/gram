import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    tsconfig: '../../tsconfig.build.json',
    banner: { js: '#!/usr/bin/env node' },
    clean: true,
  },
  {
    entry: ['src/lib.ts'],
    format: ['esm'],
    tsconfig: '../../tsconfig.build.json',
    dts: { compilerOptions: { types: ['node'] } },
    clean: false,
  },
])
