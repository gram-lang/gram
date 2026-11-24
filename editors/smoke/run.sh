#!/usr/bin/env bash
# Smoke-tests the reference configs of editors/ in real editors, in a
# throwaway container, against the server built in this checkout
# (packages/language-server/dist/server.cjs, run as gram-language-server).
#
#   editors/smoke/run.sh            # every editor
#   editors/smoke/run.sh neovim     # neovim | helix | emacs
#
# Needs podman (or docker) and `bun run build` first.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
engine="$(command -v podman || command -v docker)"
image="gram-editors-smoke"
server="$repo/packages/language-server/dist/server.cjs"

[[ -f "$server" ]] || { echo "Build the server first: bun run build" >&2; exit 1; }
"$engine" build -q -t "$image" "$here" >/dev/null

if (($#)); then editors=("$@"); else editors=(neovim helix emacs); fi

status=0
for editor in "${editors[@]}"; do
	echo "== $editor"
	"$engine" run --rm \
		-v "$repo/editors:/editors:ro,Z" \
		-v "$server:/usr/local/bin/gram-language-server:ro,Z" \
		"$image" bash "/editors/smoke/$editor.sh" || status=1
done
exit "$status"
