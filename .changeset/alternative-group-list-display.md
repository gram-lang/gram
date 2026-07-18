---
"@gram-lang/kitchen": patch
"@gram-lang/renderer": patch
---

Alternative ingredient/cookware groups (`@egg|@egg substitute`, `#pan|#skillet`) now show up correctly across shopping lists, cookware lists, and section ingredient lists, instead of being dropped or rendered as an oddly-wrapped sub-list.

**Added:**
- Alternative ingredient groups now appear in section/mise-en-place ingredient lists (they were previously skipped entirely there, even though the shopping list already included them) — shown joined on one line ("egg or egg substitute"), with each option's own preparation kept, the same way a regular ingredient's preparation already displays there ("egg substitute — vegan").

**Fixed:**
- Shopping-list and cookware-list alternative groups no longer render as a nested `<strong>Alternative Group</strong>:` sub-list — every option now joins on one line ("egg or egg substitute", "pan or skillet"), reusing the same formatter already used to render alternatives inline in step text.
- The cookware list's alternative groups previously fell back to showing only the first option with an `(alt)` badge in HTML output, since nothing set a non-inline render mode for that list — a leaf (non-alternative) cookware item's existing quantity display is unchanged.
- Composite and mixed-units-warning entries in the shopping list, cookware list, and section ingredient lists — each of which wraps its own nested sub-list — no longer get squished onto the same line as their parent label by the list's flex row layout; they now correctly flow onto their own line(s) below it.
