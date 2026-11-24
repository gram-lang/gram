-- Loaded by neovim.sh in a Neovim it drives from outside (`--remote-send`):
-- keys typed through `nvim_feedkeys` in a headless script never reach the
-- completion menu. Only answers whether the server is ready to complete.
function _G.gram_ready()
  local buf = vim.api.nvim_get_current_buf()
  local client = vim.lsp.get_clients({ bufnr = buf, name = "gram" })[1]
  if not (client and client.initialized) then return false end
  -- The ingredient database loads after the first open.
  local res = client:request_sync("textDocument/completion", {
    textDocument = vim.lsp.util.make_text_document_params(buf),
    position = { line = 8, character = 5 },
  }, 2000, buf)
  local items = res and res.result and (res.result.items or res.result) or {}
  for _, item in ipairs(items) do
    if item.label == "Wheat flour" then return true end
  end
  return false
end
