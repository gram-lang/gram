# Inside the container: Helix with editors/helix/languages.toml.
set -euo pipefail
mkdir -p ~/.config/helix
cp /editors/helix/languages.toml ~/.config/helix/languages.toml
hx --version
# Strip the colors: hx --health always prints them.
out="$(hx --health gram 2>&1 | sed "s/\x1b\[[0-9;]*m//g")"
echo "$out"
# The binary is found, the config is read (no TOML error), and the language is known.
grep -q "gram-language-server: /usr/local/bin/gram-language-server" <<<"$out" \
	|| { echo "FAIL language server not found"; exit 1; }
echo "ok   language server found"
