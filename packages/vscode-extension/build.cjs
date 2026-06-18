const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function build() {
    // Build the extension client
    await esbuild.build({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        outfile: 'dist/extension.cjs',
        format: 'cjs',
        platform: 'node',
        target: 'node18',
        external: ['vscode'],
    });

    // Copy the language server bundle into the extension's dist/
    // so the extension can reference it as a single self-contained dist/ folder
    const serverSrc = path.join(__dirname, '..', 'language-server', 'dist', 'server.cjs');
    const serverDst = path.join(__dirname, 'dist', 'server.cjs');
    if (fs.existsSync(serverSrc)) {
        fs.copyFileSync(serverSrc, serverDst);
    } else {
        console.warn('[vscode-extension/build] Language server bundle not found, skipping copy.');
        console.warn('  Expected:', serverSrc);
    }

    // Copy the shared renderer CSS
    const cssSrc = path.join(__dirname, '..', 'renderer', 'gram.css');
    const mediaDest = path.join(__dirname, 'media');
    if (!fs.existsSync(mediaDest)) {
        fs.mkdirSync(mediaDest, { recursive: true });
    }
    const cssDst = path.join(mediaDest, 'preview.css');
    if (fs.existsSync(cssSrc)) {
        fs.copyFileSync(cssSrc, cssDst);
    } else {
        console.warn('[vscode-extension/build] Renderer CSS not found, skipping copy.');
        console.warn('  Expected:', cssSrc);
    }
}

build().catch(() => process.exit(1));
