# Inside the container: Neovim with editors/neovim/gram.lua as its config.
set -euo pipefail
cp -r /editors/smoke/project /tmp/project
mkdir -p ~/.config/nvim/plugin
cp /editors/neovim/gram.lua ~/.config/nvim/plugin/gram.lua
nvim --version | head -1
cd /tmp/project
nvim --headless -c 'luafile /editors/smoke/neovim.lua' bread.gram
