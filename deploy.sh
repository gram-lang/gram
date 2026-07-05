#!/bin/bash
set -e

# Configuration
URL="https://abiwab.codeberg.page/gram/"
TMP_DIR="/tmp/gram_build"

echo "🚀 Starting deployment process..."

bunx turbo run build


# 1. Back up the compiled content (from main)
git checkout main
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# Copy Docs to root
cp -r packages/docs/src/.vitepress/dist/. "$TMP_DIR/"

# Bypass Jekyll on Codeberg Pages
touch "$TMP_DIR/.nojekyll"


# 2. Deploy from TMP_DIR
echo "📦 Packaging for deployment..."
cd "$TMP_DIR"
git init
git checkout -b pages
git add .
git commit -m "Update site [skip ci]"

echo "🚀 Pushing to Codeberg Pages..."
# Retrieve the origin URL from the main repo
REMOTE_URL=$(cd - > /dev/null && git config --get remote.origin.url)
git push "$REMOTE_URL" pages --force

# 3. Clean up
cd - > /dev/null
rm -rf "$TMP_DIR"

echo "✨ Deployment successful!"
echo "🌍 Opening $URL"

# Open browser command (Linux or Mac)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$URL"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open "$URL"
fi