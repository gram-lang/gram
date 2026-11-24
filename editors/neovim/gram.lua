-- Gram recipes in Neovim 0.11+: put this file in ~/.config/nvim/plugin/gram.lua
vim.filetype.add({ extension = { gram = "gram" } })

vim.lsp.config("gram", {
  cmd = { "gram-language-server", "--stdio" },
  filetypes = { "gram" },
  root_markers = { ".gram", ".git" },
  -- No preview panel in Neovim: ask the server for no view.
  init_options = { views = false },
  on_attach = function(client, buf)
    -- Neovim's own completion (<C-x><C-o>), with snippets: `@Wheat flour{}`
    -- with the cursor between the braces. Without it, Neovim 0.11 inserts
    -- the bare name and drops the braces.
    vim.lsp.completion.enable(true, client.id, buf)
  end,
})
vim.lsp.enable("gram")

vim.api.nvim_create_autocmd("FileType", {
  pattern = "gram",
  callback = function(ev)
    -- `gc` comments with //
    vim.bo[ev.buf].commentstring = "// %s"
    -- Always a completion menu, accepted with <C-y>: Neovim 0.11 expands a
    -- snippet only when it is accepted from a menu, and inserts a single
    -- match with no menu otherwise (`@Wheat flour` without its braces).
    vim.bo[ev.buf].completeopt = "menu,menuone,noinsert"
  end,
})

-- Colors for the server's semantic tokens, in .gram files only: the default
-- theme draws these token types in the text color. A theme of yours that
-- sets them wins (`default = true`).
local function gram_colors()
  local links = {
    ["@lsp.type.parameter.gram"] = "Identifier", -- @ingredients, #cookware
    ["@lsp.type.variable.gram"] = "Special", -- &references, timers, temperatures
    ["@lsp.type.namespace.gram"] = "Title", -- ## section titles
  }
  for group, target in pairs(links) do
    vim.api.nvim_set_hl(0, group, { link = target, default = true })
  end
end
gram_colors()
-- A colorscheme clears the highlights: link them again after each.
vim.api.nvim_create_autocmd("ColorScheme", { callback = gram_colors })
