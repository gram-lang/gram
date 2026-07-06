const fs = require('fs');
const { execSync } = require('child_process');

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const originalName = pkg.name;

// VS Code extension names cannot contain `@` or `/`
pkg.name = originalName.replace('@gram-lang/', 'gram-');
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

try {
  execSync('vsce package --no-dependencies', { stdio: 'inherit' });
} finally {
  pkg.name = originalName;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
