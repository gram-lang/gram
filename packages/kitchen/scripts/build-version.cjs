const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
const tsFile = path.join(__dirname, '../src/version.ts');

// The `generator` field of the compiled JSON reads this — bundlers and tests
// alike can import it without reaching outside `src/`.
const output = `// AUTO-GENERATED FILE. DO NOT EDIT.\nexport const KITCHEN_VERSION = ${JSON.stringify(pkg.version)};\n`;

// Only rewrite on change so a no-op build doesn't dirty the tree.
if (!fs.existsSync(tsFile) || fs.readFileSync(tsFile, 'utf-8') !== output) {
	fs.writeFileSync(tsFile, output);
	console.log('✅ src/version.ts generated');
}
