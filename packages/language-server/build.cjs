const { chmodSync } = require('node:fs');
const esbuild = require('esbuild');
const isWatch = process.argv.includes('--watch');

const OUTFILE = 'dist/server.cjs';

const config = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: OUTFILE,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    // The bundle is also the `gram-language-server` binary.
    banner: { js: '#!/usr/bin/env node' },
    define: { __GRAM_LS_VERSION__: JSON.stringify(require('./package.json').version) },
    plugins: [
        {
            name: 'executable',
            setup(build) {
                build.onEnd((result) => {
                    if (result.errors.length === 0) chmodSync(OUTFILE, 0o755);
                });
            },
        },
    ],
};

if (isWatch) {
    esbuild.context(config).then(ctx => ctx.watch());
} else {
    esbuild.build(config).catch(() => process.exit(1));
}
