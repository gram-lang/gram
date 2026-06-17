const esbuild = require('esbuild');
const isWatch = process.argv.includes('--watch');

const config = {
    entryPoints: ['src/server.ts'],
    bundle: true,
    outfile: 'dist/server.js',
    format: 'cjs',
    platform: 'node',
    target: 'node18',
};

if (isWatch) {
    esbuild.context(config).then(ctx => ctx.watch());
} else {
    esbuild.build(config).catch(() => process.exit(1));
}
