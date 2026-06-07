#!/bin/bash
set -e

# Configuration
URL="https://abiwab.codeberg.page/gram/"
TMP_DIR="/tmp/gram_build"

echo "🚀 Starting deployment process..."

bun run build
bun run build:playground

# 1. Back up the playground content (from main)
git checkout main
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
# Using rsync to exclude node_modules
rsync -av --exclude='node_modules' --exclude='.git' packages/playground/ "$TMP_DIR/"

# 2. Clean the pages branch
git checkout pages
# Remove everything currently tracked by Git on this branch
git rm -rf . > /dev/null

# 3. Restore clean content to the root
# Using a robust copy method to include hidden files if any
cp -r "$TMP_DIR"/. .

# 4. Push to Codeberg
git add .
# Avoid error if there are no changes to commit
git commit -m "Update playground [skip ci]" || echo "No changes to commit."
git push origin pages --force

# 5. Return to main branch and open the site
git checkout main

echo "✨ Deployment successful!"
echo "🌍 Opening $URL"

# Open browser command (Linux or Mac)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$URL"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open "$URL"
fi