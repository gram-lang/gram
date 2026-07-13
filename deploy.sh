#!/bin/bash
set -e

# Configuration
URL="https://gram-lang.org"
TMP_DIR="/tmp/gram_build"

echo "🚀 Starting deployment process..."

# Confirm we're deploying from main — checkout is silent/surprising otherwise.
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

bunx turbo run build

# Gate: never deploy on a red test suite.
echo "🧪 Running tests before deployment…"
bun test

REMOTE_URL=$(git config --get remote.origin.url)

# 1. Prepare the deployment worktree, preserving the `pages` branch's history
# when it already exists (instead of a fresh `git init` + force-push each time)
# so a bad deploy can be rolled back with a normal `git revert`/`git reset`.
rm -rf "$TMP_DIR"
if git ls-remote --exit-code --heads "$REMOTE_URL" pages > /dev/null 2>&1; then
    echo "📦 Cloning existing 'pages' branch history…"
    git clone --branch pages --single-branch --depth 50 "$REMOTE_URL" "$TMP_DIR"
else
    echo "📦 No existing 'pages' branch found — starting one."
    mkdir -p "$TMP_DIR"
    git -C "$TMP_DIR" init
    git -C "$TMP_DIR" checkout -b pages
fi

# Clear previously deployed files (but keep .git/ and its history) before
# copying the fresh build output, so removed/renamed files show up as deletions.
find "$TMP_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

# Copy Docs to root
cp -r packages/docs/src/.vitepress/dist/. "$TMP_DIR/"

# Bypass Jekyll on Codeberg Pages
touch "$TMP_DIR/.nojekyll"

# Custom domain for Codeberg Pages
echo "gram-lang.org" > "$TMP_DIR/.domains"

# 2. Commit and push (fast-forward, not --force, now that history is preserved)
cd "$TMP_DIR"
git add -A
if git diff --cached --quiet; then
    echo "✨ Nothing changed since the last deploy — skipping push."
else
    git commit -m "Update site [skip ci]"
    echo "🚀 Pushing to Codeberg Pages…"
    git push "$REMOTE_URL" pages
fi

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
