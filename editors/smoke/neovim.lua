-- Run by neovim.sh on bread.gram: every LSP feature through Neovim's own client.
local failures = 0
local function check(cond, what)
  io.stdout:write((cond and "ok   " or "FAIL ") .. what .. "\n")
  if not cond then failures = failures + 1 end
end
local function finish()
  vim.cmd(failures == 0 and "qall!" or "cquit! 1")
end

local buf = vim.api.nvim_get_current_buf()
check(vim.bo[buf].filetype == "gram", "filetype gram")
check(vim.bo[buf].commentstring == "// %s", "commentstring // %s")
check(vim.bo[buf].completeopt == "menu,menuone,noinsert", "completeopt menu,menuone,noinsert")
for group, target in pairs({ parameter = "Identifier", variable = "Special", namespace = "Title" }) do
  local link = vim.api.nvim_get_hl(0, { name = "@lsp.type." .. group .. ".gram" }).link
  check(link == target, "@lsp.type." .. group .. ".gram -> " .. tostring(link))
end

local client
vim.wait(10000, function()
  client = vim.lsp.get_clients({ bufnr = buf, name = "gram" })[1]
  return client ~= nil and client.initialized
end, 50)
check(client ~= nil, "client attached")
if not client then return finish() end
check(client.config.init_options.views == false, "init_options views = false")

local function at(line, col)
  return {
    textDocument = vim.lsp.util.make_text_document_params(buf),
    position = { line = line, character = col },
  }
end
local function request(method, params)
  local res = client:request_sync(method, params, 5000, buf)
  return res and res.result, res and res.err
end

-- Line 9 (1-based): "Mix @flour{ 200 g } with @water{120 g}".
-- The ingredient database loads after the first open: retry, like an editor would.
local text = ""
vim.wait(8000, function()
  local hover = request("textDocument/hover", at(8, 6))
  text = hover and (hover.contents.value or vim.inspect(hover.contents)) or ""
  return text:find("Wheat flour", 1, true) ~= nil
end, 100)
check(text:find("Wheat flour", 1, true) ~= nil, "hover shows the database name")

local labels = {}
vim.wait(8000, function()
  local completion = request("textDocument/completion", at(8, 5))
  local items = completion and (completion.items or completion) or {}
  labels = vim.tbl_map(function(i) return i.label end, items)
  return vim.tbl_contains(labels, "Wheat flour")
end, 100)
check(vim.tbl_contains(labels, "Wheat flour"), "completion after @ (" .. #labels .. " items)")

local edits = request("textDocument/formatting", {
  textDocument = vim.lsp.util.make_text_document_params(buf),
  options = { tabSize = 2, insertSpaces = true },
}) or {}
local newText = table.concat(vim.tbl_map(function(e) return e.newText end, edits))
check(newText:find("@flour{200 g}", 1, true) ~= nil, "formatting")

-- Line 13: "Bake the &dough for ~{30 min}."
local p = at(12, 10)
p.newName = "paste"
local rename = request("textDocument/rename", p)
local changes = rename and (rename.changes or rename.documentChanges)
check(changes ~= nil and next(changes) ~= nil, "rename of &dough")

-- Neovim applies the server's semantic tokens on its own.
local token
vim.wait(5000, function()
  token = vim.inspect_pos(buf, 8, 6).semantic_tokens[1]
  return token ~= nil
end, 50)
check(token ~= nil, "semantic token on flour: " .. (token and token.opts.hl_group or "none"))

-- Diagnostics, on a document that does not parse.
vim.cmd.edit("broken.gram")
local broken = vim.api.nvim_get_current_buf()
vim.wait(10000, function() return #vim.diagnostic.get(broken) > 0 end, 50)
local diags = vim.diagnostic.get(broken)
check(#diags > 0, "diagnostics: " .. (diags[1] and diags[1].message:gsub("\n.*", "") or "none"))

finish()
