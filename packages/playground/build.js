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

// 1. Prepare Parser Code (Shimmed)
const grammarPath = path.join(__dirname, '../parser/grammar.ohm');
const grammarContent = fs.readFileSync(grammarPath, 'utf-8');

// Use the COMPILED output from TypeScript
const parserPath = path.join(__dirname, '../parser/dist/index.js');
let parserCode = fs.readFileSync(parserPath, 'utf-8');

// Shim Node.js dependencies and inject grammar
// 1. Remove fs/path imports
parserCode = parserCode.replace(/require\("fs"\)/g, '({})');
parserCode = parserCode.replace(/require\("path"\)/g, '({})');
parserCode = parserCode.replace(/require\("\.\/types"\)/g, '({})');

// 2. Remove file reading logic (assuming variable names match dist output)
// This relies on the emitted JS having "grammarPath" and "grammarContent" variables.
// If they are optimized away or renamed, this might fail.
// We fallback to replacing the fs.readFileSync calls if variables are not found?
// But tsc output usually preserves variable names if they are top-level constants.

parserCode = parserCode.replace(/const grammarPath = .*/, '// grammarPath suppressed');
parserCode = parserCode.replace(/const grammarContent = .*/, `const grammarContent = ${JSON.stringify(grammarContent)};`);

// 3. Remove/Fix unused imports?
// gram-parser now only exports types and getAST. No internal compiler import to fix.

const shimmedParserPath = path.join(__dirname, 'src/shimmed-gram-parser.js');
fs.writeFileSync(shimmedParserPath, parserCode);

// 2. Build App & CSS
esbuild.build({
  entryPoints: ['src/app.js', 'src/style.css'],
  bundle: true,
  outdir: 'dist',
  minify: true,
  sourcemap: true,
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: 'assets/[name]-[hash]',
  // Actually, user wants NO hash changing every time if content changes?
  // Or just stable names? 
  // If we remove [hash], cache busting breaks.
  // But for git usage, stable names are better.
  // Let's try to control the output name of the dynamic import bundle.
  // esbuild default for code splitting chunks is [name]-[hash].
  // If we set it to [name], we might get conflicts or cache issues, but git history will be clean.
  chunkNames: 'chunks/[name]', 
  alias: {
      'gram-parser': shimmedParserPath,
      'gram-compiler': path.resolve(__dirname, '../compiler/dist/lite.js')
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
    fs.unlinkSync(shimmedParserPath);

    // Copy examples to dist
    // Copy examples to dist and generate manifest
    const examplesSrc = path.join(__dirname, '../../examples');
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

        // Read title from file content
        const content = fs.readFileSync(srcPath, 'utf-8');
        
        // Try YAML Frontmatter Title
        const yamlMatch = content.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
        
        // Try Markdown h2 Title
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
