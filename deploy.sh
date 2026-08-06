#!/bin/bash
set -e

URL="https://gram-lang.org"

echo "🚀 Starting deployment process..."

# 1. Checking main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    read -p "You are on branch '$CURRENT_BRANCH', not 'main'. Switch to main and deploy from there? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi
git checkout main

# 2. Build & Run tests
echo "🔨 Building project..."
bunx turbo run build --force

echo "🧪 Running tests before deployment…"
bun test

# 3. Uploading documentation & playground to VPS via rsync
echo "🚀 Uploading documentation & playground to VPS..."
rsync -avz --delete packages/docs/dist/ VPS:/var/www/gram-lang.org/

echo "✨ Deployment successful!"
echo "🌍 Opening $URL"

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$URL"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    open "$URL"
fi
