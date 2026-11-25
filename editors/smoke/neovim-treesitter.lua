-- Run by neovim.sh on bread.gram, with gram-treesitter.lua and the parser
-- installed by build-parser.sh: Tree-sitter colors and section folds.
local failures = 0
local function check(cond, what)
  io.stdout:write((cond and "ok   " or "FAIL ") .. what .. "\n")
  if not cond then failures = failures + 1 end
end

local buf = vim.api.nvim_get_current_buf()
check(vim.treesitter.highlighter.active[buf] ~= nil, "tree-sitter highlighting on")

-- 0-based positions in bread.gram, and a capture expected there.
local function captures(row, col)
  return vim.tbl_map(function(c) return c.capture end, vim.treesitter.get_captures_at_pos(buf, row, col))
end
for _, case in ipairs({
  { 6, 0, "markup.heading", "section header" }, -- "## Dough ->&dough"
  { 8, 5, "type", "ingredient name" }, -- "Mix @flour{ 200 g }"
  { 8, 12, "number", "quantity" }, -- the 200 that semantic tokens leave uncolored
  { 12, 11, "tag", "reference name" }, -- "Bake the &dough"
}) do
  local caps = captures(case[1], case[2])
  check(vim.tbl_contains(caps, case[3]), case[4] .. ": " .. table.concat(caps, ","))
end

-- Line 7 (1-based) opens the first section's fold.
check(vim.wo.foldmethod == "expr", "foldmethod expr")
check(vim.treesitter.foldexpr(7) == ">1", "section fold: " .. tostring(vim.treesitter.foldexpr(7)))

vim.cmd(failures == 0 and "qall!" or "cquit! 1")
