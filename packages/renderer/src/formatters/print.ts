import type { RendererOptions, RenderContext } from "../types";
import {
	formatDuration as defaultFormatDuration,
	escapeHtml,
	aggToRendererItem,
	isAlternativeGroup,
	isCompositeItem,
	joinStepTokens,
} from "../utils";
import { formatElement } from "./element";
import { aggregateSectionIngredients } from "@gram-lang/kitchen";
import { getDictionary } from "@gram-lang/i18n";

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700&display=swap');

  :root {
    --black: #000000;
    --dark-grey: #333333;
    --grey: #666666;
    --light-grey: #cccccc;
    --very-light-grey: #e5e5e5;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4;
    margin: 25mm 20mm;
  }

  body {
    font-family: 'Courier Prime', 'Courier New', Courier, monospace;
    font-size: 10pt;
    line-height: 1.5;
    color: var(--black);
    background: #fff;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Title ── */
  h1 {
    font-family: 'Courier Prime', monospace;
    font-size: 20pt;
    font-weight: 700;
    line-height: 1.1;
    margin-bottom: 12pt;
    padding-bottom: 8pt;
    border-bottom: 2pt solid var(--black);
    page-break-after: avoid;
  }

  /* ── Section labels (Shopping, Equipment, Instructions…) ── */
  h2 {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    border-bottom: 1px solid var(--black);
    padding-bottom: 6pt;
    margin-top: 24pt;
    margin-bottom: 12pt;
    page-break-after: avoid;
  }

  /* ── Sub-section headers (recipe sections) ── */
  h3 {
    font-size: 11.5pt;
    font-weight: 700;
    margin-top: 20pt;
    margin-bottom: 10pt;
    page-break-after: avoid;
    display: inline-block;
    border-bottom: 1px dashed var(--black);
  }

  /* ── Meta bar ── */
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4pt 16pt;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 8pt;
    margin-bottom: 16pt;
    padding: 4pt 0;
    border-bottom: 1px solid var(--light-grey);
  }
  .meta-item { display: flex; align-items: baseline; }
  .meta-label {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 7pt;
    letter-spacing: 0.1em;
    margin-right: 6pt;
    color: var(--grey);
  }

  /* ── Shopping list ── */
  .shopping-list ul {
    columns: 2;
    column-gap: 24pt;
    list-style: none;
    margin-top: 8pt;
  }
  .shopping-list li {
    break-inside: avoid;
    page-break-inside: avoid;
    position: relative;
    padding: 3pt 0 3pt 16pt;
    font-size: 9.5pt;
    border-bottom: 1px dotted var(--light-grey);
  }
  .shopping-list li::before {
    content: "☐";
    position: absolute;
    left: 0;
    top: 3.5pt;
    font-size: 11pt;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--grey);
  }

  /* ── Equipment ── */
  .cookware-list {
    display: flex;
    flex-wrap: wrap;
    column-gap: 12pt;
    row-gap: 6pt;
    margin-top: 8pt;
    font-size: 10pt;
    font-style: italic;
  }
  .cookware-list .cw-item {
    position: relative;
  }
  .cookware-list .cw-item:not(:last-child)::after { 
    content: "•"; 
    position: absolute;
    right: -8pt;
    color: var(--light-grey); 
    font-style: normal; 
  }

  /* ── Instructions ── */
  .instructions section {
    margin-bottom: 24pt;
  }

  /* ── Section-level mise en place ── */
  .section-ingredients {
    border: 1px solid var(--black);
    border-left: 4pt solid var(--black);
    padding: 10pt 14pt;
    margin-bottom: 16pt;
    margin-top: 8pt;
  }
  .section-ingredients ul {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    column-gap: 16pt;
    row-gap: 6pt;
    font-size: 9.5pt;
  }
  .section-ingredients li { white-space: nowrap; }
  .section-ingredients li::before { 
    content: "— "; 
    color: var(--grey); 
    font-weight: bold; 
  }

  /* ── Steps ── */
  ol.steps {
    margin: 0;
    padding-left: 0;
    list-style: none;
    counter-reset: step-counter;
  }
  ol.steps li {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 10pt;
    font-size: 10pt;
    position: relative;
    padding-left: 24pt;
  }
  ol.steps li:not(.comment-step)::before {
    content: counter(step-counter) ".";
    counter-increment: step-counter;
    position: absolute;
    left: 0;
    top: 0;
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 700;
    font-size: 9pt;
    color: var(--black);
  }

  /* ── Action tag ── */
  .action {
    display: inline-block;
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 700;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    border: 1px solid var(--black);
    border-radius: 2px;
    padding: 2pt 5pt;
    margin-right: 8pt;
    vertical-align: text-bottom;
    white-space: nowrap;
  }

  /* ── Inline semantic tokens ── */
  .ingredient {
    font-weight: 700;
  }
  .reference {
    font-weight: 700;
    text-decoration: underline;
    text-decoration-style: solid;
    text-underline-offset: 2.5pt;
    text-decoration-thickness: 1px;
  }
  .cookware {
    font-weight: 700;
  }
  .timer {
    font-weight: 700;
    border-bottom: 2px solid var(--black);
    white-space: nowrap;
    padding-bottom: 1px;
  }
  .timer.passive {
    border-bottom: 2px dotted var(--black);
  }
  .temp {
    font-weight: 700;
    white-space: nowrap;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0.9em;
    letter-spacing: 0.05em;
  }
  .quantity { font-weight: normal; }
  .unit { color: var(--dark-grey); font-size: 0.95em; }
  .opt { color: var(--grey); font-style: italic; }
  .declaration {
    font-size: 9pt;
    font-style: italic;
    color: var(--grey);
  }
  .comment-step {
    padding-left: 0 !important;
    font-style: italic;
    color: var(--dark-grey);
    font-size: 9.5pt;
    margin-top: -4pt;
    margin-bottom: 10pt !important;
  }

  /* ── Nutrition ── */
  .nutrition {
    margin-top: 24pt;
    padding-top: 12pt;
    border-top: 2px solid var(--black);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .nutrition h2 {
    border-bottom: none;
    margin: 0 0 12pt 0;
    padding: 0;
  }
  .nut-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12pt 24pt;
  }
  .nut-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .nut-item strong { 
    font-size: 13pt; 
    font-family: 'Inter', system-ui, sans-serif;
    line-height: 1;
    margin-bottom: 4pt;
  }
  .nut-item small { 
    font-size: 7pt; 
    text-transform: uppercase; 
    letter-spacing: 0.1em; 
    color: var(--grey); 
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* Screen preview */
  @media screen {
    body {
      max-width: 210mm;
      margin: 40px auto;
      padding: 25mm 20mm;
      box-shadow: 0 4px 40px rgba(0,0,0,0.08);
      border: 1px solid var(--very-light-grey);
      min-height: 297mm;
    }
  }
`;

const SVG = {
	// Clock (sync timer) — Lucide Clock
	clock: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;display:inline-block"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
	// Hourglass (async timer) — Lucide Hourglass
	hourglass: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;display:inline-block"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M17 2v4.172a2 2 0 0 0-.586 1.414L12 12 7.586 7.586A2 2 0 0 1 7 6.172V2"/></svg>`,
	// Thermometer — Lucide Thermometer
	thermometer: `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;display:inline-block"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
};

const PRINT_ICONS = {
	hourglass: SVG.hourglass,
	timer: SVG.clock,
	thermometer: SVG.thermometer,
	caretRight: "→",
	arrowRight: "→",
	arrowUDownLeft: "↵",
	warning: "⚠",
	pencilSimple: "✎",
	clock: SVG.clock,
	fire: "△",
	knife: "—",
	scales: "⚖",
	clockCounterClockwise: "↺",
};

export function toPrintHTML(data: any, options: RendererOptions = {}): string {
	const t = getDictionary(options.lang);
	const registry = data.registry || { ingredients: {}, cookware: {} };
	const formatDuration = options.formatDuration || defaultFormatDuration;

	const context: RenderContext = {
		registry,
		icons: PRINT_ICONS,
		formatDuration,
		formatFraction: options.formatFraction,
		bakersMathOnly: options.bakersMathOnly,
		lang: options.lang,
	};
	// Context variant used when rendering inline step tokens — hides qty if flag is set
	const stepContext: RenderContext = options.hideStepQty
		? { ...context, hideIngredientQty: true }
		: context;

	let body = "";

	// ── Title ──────────────────────────────────────────────────────────────
	if (data.title) {
		body += `<h1>${escapeHtml(data.title)}</h1>\n`;
	}

	// ── Meta bar ───────────────────────────────────────────────────────────
	body += `<div class="meta">\n`;
	if (data.metrics) {
		if (data.metrics.totalTime) {
			body += `  <span class="meta-item"><span class="meta-label">${t.renderer.totalTime}</span>${formatDuration(data.metrics.totalTime)}</span>\n`;
		}
		if (data.metrics.cookTime) {
			body += `  <span class="meta-item"><span class="meta-label">${t.renderer.cookTime}</span>${formatDuration(data.metrics.cookTime)}</span>\n`;
		}
		if (data.metrics.activeTime) {
			body += `  <span class="meta-item"><span class="meta-label">${t.renderer.activeTime}</span>${formatDuration(data.metrics.activeTime)}</span>\n`;
		}
		if (data.metrics.preparationTime) {
			body += `  <span class="meta-item"><span class="meta-label">${t.renderer.prepTime}</span>${formatDuration(data.metrics.preparationTime)} <em style="opacity:0.55;font-size:0.85em">${t.renderer.est}</em></span>\n`;
		}
	}
	if (data.meta) {
		for (const [k, v] of Object.entries(data.meta as Record<string, any>)) {
			if (k === "title") continue;
			const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
			body += `  <span class="meta-item"><span class="meta-label">${escapeHtml(label)}</span>${escapeHtml(String(v))}</span>\n`;
		}
	}
	body += `</div>\n\n`;

	// ── Shopping list ──────────────────────────────────────────────────────
	if (data.shopping_list?.length > 0) {
		body += `<div class="shopping-list">\n<h2>${t.renderer.shoppingList}</h2>\n<ul>\n`;
		for (const item of data.shopping_list) {
			if (!item || typeof item !== "object") continue;
			if (isAlternativeGroup(item)) {
				body += `  <li>${item.options.map((o: any) => formatElement(o, "html", context)).join(" <em>or</em> ")}</li>\n`;
			} else if (isCompositeItem(item)) {
				body += `  <li>${formatElement(item, "html", context)}</li>\n`;
				for (const u of item.usage ?? []) {
					body += `  <li style="padding-left:12pt">${formatElement(u, "html", context)}</li>\n`;
				}
			} else if (item.display) {
				body += `  <li>${escapeHtml(item.display)}</li>\n`;
			} else {
				body += `  <li>${formatElement(item, "html", context)}</li>\n`;
			}
		}
		body += `</ul>\n</div>\n\n`;
	}

	// ── Equipment ─────────────────────────────────────────────────────────
	if (data.cookware?.length > 0) {
		body += `<div>\n<h2>${t.renderer.equipment}</h2>\n<div class="cookware-list">\n`;
		for (const cw of data.cookware) {
			if (isAlternativeGroup(cw)) {
				const opts = (cw.options ?? [])
					.map((o: any) => formatElement(o, "html", context))
					.join(" or ");
				body += `  <span class="cw-item">${opts}</span>\n`;
			} else {
				body += `  <span class="cw-item">${formatElement(cw, "html", context)}</span>\n`;
			}
		}
		body += `</div>\n</div>\n\n`;
	}

	// ── Instructions ───────────────────────────────────────────────────────
	if (data.sections?.length > 0) {
		body += `<div class="instructions">\n<h2>Instructions</h2>\n`;
		for (const sec of data.sections) {
			body += `<section>\n`;
			if (sec.title) {
				let titleHtml = escapeHtml(sec.title);
				if (sec.retro_planning)
					titleHtml += ` <small style="opacity:0.55;font-size:0.8em">(${escapeHtml(sec.retro_planning.raw)})</small>`;
				body += `  <h3>${titleHtml}</h3>\n`;
			}

			// Section-level ingredients — aggregated (dedup, addition, intermediates)
			const secItems = aggregateSectionIngredients(sec.ingredients ?? []).map(
				aggToRendererItem,
			);
			if (secItems.length > 0) {
				body += `  <div class="section-ingredients"><ul>\n`;
				for (const ing of secItems) {
					body += `    <li>${formatElement(ing, "html", context)}</li>\n`;
				}
				body += `  </ul></div>\n`;
			}

			body += `  <ol class="steps">\n`;
			let stepCounter = 0;
			for (const stepItem of sec.steps ?? []) {
				if (!stepItem) continue;
				if (stepItem.type === "comment") {
					body += `    <li class="comment-step"><em>${escapeHtml(stepItem.value ?? "")}</em></li>\n`;
					continue;
				}
				stepCounter++;
				body += `    <li value="${stepCounter}">\n`;

				if (stepItem.action) {
					body += `      <span class="action">${escapeHtml(stepItem.action)}</span>`;
				}

				let stepContent = "";
				if (stepItem.type === "text") {
					stepContent = escapeHtml(stepItem.value ?? "");
				} else {
					stepContent = joinStepTokens(
						stepItem.content ?? [],
						(c) => formatElement(c, "html", stepContext),
						(c) => !!c && typeof c === "object" && c.type !== "comment",
					);
				}

				body += stepContent ? `      ${stepContent}\n` : "";
				body += `    </li>\n`;
			}
			body += `  </ol>\n</section>\n`;
		}
		body += `</div>\n\n`;
	}

	// ── Nutrition ──────────────────────────────────────────────────────────
	const nut = data.metrics?.nutrition;
	if (nut) {
		const vals = nut.perPortion || nut.total;
		const portionNote = nut.perPortion ? " (per portion)" : "";
		if (vals && vals.calories > 0) {
			body += `<div class="nutrition">\n<h2>${t.renderer.nutrition}${escapeHtml(portionNote)}</h2>\n<div class="nut-grid">\n`;
			body += `  <span class="nut-item"><strong>${Math.round(vals.calories)}</strong> <small>kcal</small></span>\n`;
			body += `  <span class="nut-item"><small>Protein</small> <strong>${vals.protein}g</strong></span>\n`;
			body += `  <span class="nut-item"><small>Carbs</small> <strong>${vals.carbs}g</strong></span>\n`;
			body += `  <span class="nut-item"><small>Fat</small> <strong>${vals.fat}g</strong></span>\n`;
			if (vals.fiber != null)
				body += `  <span class="nut-item"><small>Fiber</small> <strong>${vals.fiber}g</strong></span>\n`;
			if (vals.sodium != null) {
				body += `  <span class="nut-item"><small>Sodium</small> <strong>${vals.sodium}g</strong></span>\n`;
			}
			body += `</div>\n</div>\n`;
		}
	}

	// ── Full HTML document ─────────────────────────────────────────────────
	const titleTag = data.title
		? `<title>${escapeHtml(data.title)}</title>`
		: "<title>Recipe</title>";
	return `<!DOCTYPE html>
<html lang="${escapeHtml((data.meta as any)?.language ?? "en")}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${titleTag}
  <style>${PRINT_CSS}</style>
</head>
<body>
${body}</body>
</html>`;
}
