const fs = require('fs');
const path = require('path');
const { tmJsonToPlist } = require('./tm-plist.cjs');

const jsonFile = path.join(__dirname, '../syntaxes/gram.tmLanguage.json');
const plistFile = path.join(__dirname, '../syntaxes/gram.tmLanguage');

const grammar = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
fs.writeFileSync(plistFile, tmJsonToPlist(grammar));
console.log('✅ syntaxes/gram.tmLanguage generated');
