---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
"gram-lang": minor
---

**Rendering**: Modernized the HTML recipe view layout and visual design:

- Clean header with recipe title, description, and metadata byline (author, date, clickable source, tags, and custom frontmatter attributes)
- Compact hero bar for servings with interactive scaling controls, physical yield, and standardized net mass
- The portions in the hero bar come with an icon and their word in the right singular or plural (`1 portion`, `4 portions`), and a scaled recipe shows its factor (`6 portions ×1.5`). What the recipe makes, weighs and brings (yield, mass, calories) stays together: on a narrow view it moves to a line of its own under the portions, instead of wrapping one item at a time
- A page that can change the portions shows a small pencil button beside them, with a hover effect, by putting a `can-edit-portions` class around the recipe; the playground uses it to open its Portions & Scale settings. Without that class, as in an editor preview or an exported file, the button stays hidden
- Every view now says "portions", the word of the `portions:` field, in English and French alike: the recipe, its text format and the run sheet no longer mix "servings" or "parts" with "portions"
- Dedicated timings bar (`.recipe-timings-bar`) with interactive detailed breakdown tooltips
- Recipe-level notes callout for frontmatter notes
- Responsive grid layout with dot leaders for section ingredients and equipment, dynamically adapting from single column on narrow panels to multi-column layouts on wider viewports, aligning names on the left and quantities or standardized masses on the right with preparation notes underneath
- Suppressed redundant ingredient quantity tooltips in inline step text when quantities are already visibly displayed next to the ingredient, reserving quantity tooltips for when inline step quantities are hidden (`hideStepQty`)
- Tooltips of ingredients, intermediates and cookware in the steps are now small cards: the name with an "Optional" badge, then aligned rows for the quantity, the weight, the preparation and what a part is taken from (`Taken from: 6 eggs`). An estimated weight says how it was estimated (average density or unit weight), a weight already in grams is no longer repeated, cookware shows `×12`, and the "(alt)" badge lists each substitute with its own quantity
- The printed recipe no longer carries any tooltip, since paper cannot show them
- The printed recipe (`toPrintHTML`, `gram print`, `gram export --format html`) now looks like the one on screen, as the run sheet already did: the same header, timings and hero bar, the shopping list with boxes to tick and dot leaders, the ingredients of each section in a frame, numbered steps with outlined temperatures and filled timers, and the nutrition table, all in black and white for the page. The printed recipe and run sheet now use exactly the fonts of the screen, instead of a typewriter font, and the run sheet's title is no longer set in spaced-out capitals
- Interactive intermediate ingredient traceability: what a step makes is written on its own line under the step (`↳ dough`), with bidirectional highlight/smooth scroll navigation when hovering or clicking references (`.reference[data-ref-id]` and `[data-declares]` producer steps or sections)
- Ingredient and cookware highlighting: hovering an item in a section's list highlights the steps of that section where it is used, and hovering it in the shopping list highlights them across the whole recipe
- Step completion checklist: clicking on a step number marks the step as completed (`.is-completed`) with a checkmark badge and softened opacity
- Composite ingredients in the shopping list: one checkbox for the item you buy (eggs, lemons) with its count, and the parts the recipe uses (yolks, juice, the share used whole) listed underneath as small lines with their own quantities, instead of a "(Composite)" badge and a checkbox per part
- Cookware shows how many you need right in the list (`pan ×2`), aligned like ingredient quantities, and nothing when you need just one
- Footnote marks (`[1]`) stay on the line of the word they annotate instead of wrapping alone to the next line
- In the steps of the recipe and the run sheet, on screen and on paper, a timer or a temperature keeps the punctuation written against it: the full stop after `30 min` or the parentheses around `200 °C` no longer wrap alone to the next line
- Shopping list copy button: added a discreet copy button aligned with the shopping list section title with formatted clipboard export and visual confirmation feedback
- Universal floating tooltip engine (`attachTooltips`, `TOOLTIP_SCRIPT`) with viewport-edge clamping and boundary collision prevention, suppressing duplicate tooltips across surfaces
- Each view now has its own styles, kept to its own root element: the recipe is written in an `<article class="gram-recipe">` and the run sheet in a `<section class="gram-run-sheet">`. A style written for one view can no longer change another, and a view keeps its look wherever its HTML is placed, with or without a `.gram-preview` container around it
- `@gram-lang/renderer/gram.css` is imported as before; the file itself is now built into the package's `dist/` folder, and the package lists its entry points (`exports`). It uses the CSS `@scope` rule, supported by every current browser
- The run sheet no longer borrows the green dotted underline of the recipe's intermediates: they stay in the text color, like the rest of the sheet
- The run sheet lists what to take out like the recipe does: as many columns as the space holds (one in a narrow editor pane or on a phone, two on a wide page), a long name wrapping instead of pushing its quantity off the line, and the preparation or "in stock" note written underneath the name

**Deprecated**

- Renderer: the `interactiveScaling` option of `toHTML()`, and the `decreasePortions`, `increasePortions` and `editPortions` strings of `@gram-lang/i18n`, removed in 2.0.0. The portions stepper they draw only works where the page around the recipe handles its buttons, so it did nothing in an exported file or an editor preview. Scale the recipe before rendering it instead (`applyScale()` of `@gram-lang/kitchen`): the recipe then shows its portions and its scale factor by itself. The option keeps working until 2.0.0
