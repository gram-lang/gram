#!/bin/sh
# Tree-sitter colors for Gram recipes in Neovim: builds the tree-sitter-gram
# parser with a C compiler and installs it, with its queries, into your Neovim
# config (parser/gram.so and queries/gram/). Run it again to update.
# Needs git and a C compiler (cc, or the one named by $CC).
set -eu

REPO="https://github.com/gram-lang/tree-sitter-gram"
REV="854cfed0205a5b893aea8b8e27a238cfe7d9d716" # v0.1.0
NVIM="${XDG_CONFIG_HOME:-$HOME/.config}/nvim"

src="$(mktemp -d)"
trap 'rm -rf "$src"' EXIT
git -C "$src" init -q
git -C "$src" fetch -q --depth 1 "$REPO" "$REV"
git -C "$src" checkout -q FETCH_HEAD

mkdir -p "$NVIM/parser" "$NVIM/queries/gram"
"${CC:-cc}" -shared -fPIC -O2 -I "$src/src" \
	"$src/src/parser.c" "$src/src/scanner.c" -o "$NVIM/parser/gram.so"
# Neovim's queries sit at the root of queries/ (helix/ and zed/ are for others).
cp "$src"/queries/*.scm "$NVIM/queries/gram/"
echo "tree-sitter-gram installed in $NVIM"
