# Inside the container: Emacs with editors/emacs/gram.el, eglot in batch mode.
set -euo pipefail
cp -r /editors/smoke/project /tmp/project
emacs --version | head -1
cd /tmp/project
emacs --batch -l /editors/emacs/gram.el -l /editors/smoke/emacs.el
