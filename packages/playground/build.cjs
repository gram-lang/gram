const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pkg = require('./package.json');

// Get Git Commit Hash
let commitHash = 'dev';
try {
    commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
    console.warn('Failed to get git commit hash, defaulting to dev');
}

const version = `${pkg.version}-${commitHash}`;
const repoUrl = pkg.repository.url.replace(/\.git$/, '');

// Build App & CSS
esbuild.build({
  entryPoints: ['src/app.js', 'src/style.css'],
  bundle: true,
  outdir: 'dist',
  minify: true,
  sourcemap: true,
  format: 'esm',
  splitting: true,
  assetNames: 'assets/[name]-[hash]',
  // Use stable chunk names for cleaner git history
  chunkNames: 'chunks/[name]', 
  alias: {
      '@gram/parser': path.resolve(__dirname, '../parser/dist/index.js'),
      '@gram/compiler': path.resolve(__dirname, '../compiler/dist/index.js'),
      '@gram/analyzer': path.resolve(__dirname, '../analyzer/dist/index.js'),
      '@gram/renderer': path.resolve(__dirname, '../renderer/dist/index.js')
  },
  plugins: [
      require('esbuild-plugin-yaml').yamlPlugin()
  ],
  define: {
      'process.env.GRAM_VERSION': JSON.stringify(version),
      'process.env.REPO_URL': JSON.stringify(repoUrl)
  }
}).then(() => {
    console.log('Build successful!');

    // Generate examples manifest and copy files
    const examplesSrc = path.join(__dirname, 'src/examples');
    const examplesDest = path.join(__dirname, 'dist/examples');
    if (!fs.existsSync(examplesDest)) {
        fs.mkdirSync(examplesDest, { recursive: true });
    }

    const manifest = [];

    fs.readdirSync(examplesSrc).forEach(file => {
        if (!file.endsWith('.gram')) return;

        const srcPath = path.join(examplesSrc, file);
        const destPath = path.join(examplesDest, file);
        fs.copyFileSync(srcPath, destPath);

        // Extract title from YAML Frontmatter or Markdown H2
        const content = fs.readFileSync(srcPath, 'utf-8');
        const yamlMatch = content.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
        const h2Match = content.match(/^##\s+(.+)$/m);
        
        const title = yamlMatch ? yamlMatch[1].trim() : (h2Match ? h2Match[1].trim() : file.replace('.gram', ''));
        
        manifest.push({
            id: file,
            title: title,
            path: `dist/examples/${file}`
        });
    });

    // Write manifest
    fs.writeFileSync(path.join(examplesDest, 'manifest.json'), JSON.stringify(manifest, null, 2));

    console.log('Examples copied to dist/ and manifest.json generated.');
}).catch((e) => {
    console.error(e);
    process.exit(1);
});
