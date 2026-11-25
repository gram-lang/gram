# Inside the container: Helix with editors/helix/languages.toml.
set -euo pipefail
mkdir -p ~/.config/helix
# Only Gram's grammar: `hx --grammar fetch` would otherwise fetch every
# grammar Helix knows (use-grammars must come first in the file).
{ echo 'use-grammars = { only = ["gram"] }'; cat /editors/helix/languages.toml; } >~/.config/helix/languages.toml
hx --version

# The steps of the comment in languages.toml.
hx --grammar fetch >/dev/null
hx --grammar build >/dev/null
runtime=~/.config/helix/runtime
mkdir -p "$runtime/queries/gram"
cp "$runtime"/grammars/sources/gram/queries/helix/*.scm "$runtime/queries/gram/"
# `hx --health` reports the parser even when none was built: check the file.
[[ -f "$runtime/grammars/gram.so" ]] || { echo "FAIL grammar not built"; exit 1; }
echo "ok   grammar built at the pinned rev ($(git -C "$runtime/grammars/sources/gram" rev-parse --short HEAD))"

# Strip the colors: hx --health always prints them.
out="$(hx --health gram 2>&1 | sed "s/\x1b\[[0-9;]*m//g")"
echo "$out"
# The binary is found, the config is read (no TOML error), and the language is known.
grep -q "gram-language-server: /usr/local/bin/gram-language-server" <<<"$out" \
	|| { echo "FAIL language server not found"; exit 1; }
echo "ok   language server found"
grep -q "Highlight queries: ✓" <<<"$out" || { echo "FAIL highlight queries not found"; exit 1; }
echo "ok   highlight queries found"
