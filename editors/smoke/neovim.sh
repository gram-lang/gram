# Inside the container: Neovim with editors/neovim/gram.lua as its config,
# then gram-treesitter.lua and the parser of build-parser.sh.
set -euo pipefail
cp -r /editors/smoke/project /tmp/project
mkdir -p ~/.config/nvim/plugin
cp /editors/neovim/gram.lua ~/.config/nvim/plugin/gram.lua
nvim --version | head -1
cd /tmp/project
nvim --headless -c 'luafile /editors/smoke/neovim.lua' bread.gram

# Completion through Neovim's own menu (<C-x><C-o>), driven from outside: the
# snippet must leave the cursor between the braces.
sock=/tmp/nvim.sock
nvim --headless --listen "$sock" -c 'luafile /editors/smoke/neovim-complete.lua' bread.gram >/dev/null 2>&1 &
nvim_pid=$!
remote() { nvim --server "$sock" "$@"; }
ready=false
for _ in $(seq 100); do
	if [[ -S $sock ]] && [[ "$(remote --remote-expr 'v:lua.gram_ready()' 2>/dev/null)" == "true" ]]; then
		ready=true
		break
	fi
	sleep 0.1
done
if ! $ready; then
	echo "FAIL completion: the server never got ready"
	kill "$nvim_pid"
	exit 1
fi
remote --remote-send 'Go@Whe<C-x><C-o>'
sleep 1
# gram.lua always opens the menu (menuone): accept the match from it.
if [[ "$(remote --remote-expr 'pumvisible()')" == 0 ]]; then
	echo "FAIL completion: no menu"
	remote --remote-send '<Esc>:qall!<CR>' || true
	exit 1
fi
remote --remote-send '<C-y>'
sleep 0.5
remote --remote-send '200 g<Esc>'
sleep 0.5
line="$(remote --remote-expr "getline('$')")"
remote --remote-send ':qall!<CR>' || true
wait "$nvim_pid" || true
if [[ $line == "@Wheat flour{200 g}" ]]; then
	echo "ok   completion inserts $line"
else
	echo "FAIL completion inserts $line (expected @Wheat flour{200 g})"
	exit 1
fi

# Tree-sitter colors and folds: the parser built by build-parser.sh.
sh /editors/neovim/build-parser.sh
cp /editors/neovim/gram-treesitter.lua ~/.config/nvim/plugin/gram-treesitter.lua
nvim --headless -c 'luafile /editors/smoke/neovim-treesitter.lua' bread.gram
