const fs = require('fs');
const path = require('path');

const ohmFile = path.join(__dirname, '../grammar.ohm');
const tsFile = path.join(__dirname, '../src/grammar-content.ts');

const content = fs.readFileSync(ohmFile, 'utf-8');

// Generate a TS file exporting grammar
const output = `// AUTO-GENERATED FILE. DO NOT EDIT.\nexport const grammarContent = ${JSON.stringify(content)};\n`;

fs.writeFileSync(tsFile, output);
console.log('✅ src/grammar-content.ts generated');
