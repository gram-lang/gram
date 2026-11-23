-- Gram recipes in Neovim 0.11+: put this file in ~/.config/nvim/plugin/gram.lua
vim.filetype.add({ extension = { gram = "gram" } })

vim.lsp.config("gram", {
  cmd = { "gram-language-server", "--stdio" },
  filetypes = { "gram" },
  root_markers = { ".gram", ".git" },
  -- No preview panel in Neovim: ask the server for no view.
  init_options = { views = false },
})
vim.lsp.enable("gram")

-- `gc` comments with //
vim.api.nvim_create_autocmd("FileType", {
  pattern = "gram",
  callback = function(ev)
    vim.bo[ev.buf].commentstring = "// %s"
  end,
})
