-- Tree-sitter colors and section folds for Gram recipes, next to gram.lua:
-- put this file in ~/.config/nvim/plugin/gram-treesitter.lua, then run
-- build-parser.sh once to install the parser and its queries.
vim.api.nvim_create_autocmd("FileType", {
  pattern = "gram",
  callback = function(ev)
    -- Parser not installed yet: the server's semantic tokens still color.
    if not vim.treesitter.language.add("gram") then return end
    vim.treesitter.start(ev.buf, "gram")
    -- Fold the frontmatter and each section (zc, zo, za), all open at first.
    vim.wo[0][0].foldexpr = "v:lua.vim.treesitter.foldexpr()"
    vim.wo[0][0].foldmethod = "expr"
    vim.wo[0][0].foldlevel = 99
  end,
})
