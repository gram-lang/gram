import { RendererOptions, RenderContext } from '../types';
import { formatDuration as defaultFormatDuration, escapeHtml, aggToRendererItem } from '../utils';
import { formatElement } from './element';
import { aggregateSectionIngredients } from '@gram/kitchen';

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4;
    margin: 20mm 22mm 20mm 22mm;
  }

  body {
    font-family: 'Courier Prime', 'Courier New', Courier, monospace;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #000;
    background: #fff;
  }

  /* ── Title ── */
  h1 {
    font-size: 21pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin-bottom: 6pt;
    page-break-after: avoid;
  }

  /* ── Section labels (Shopping, Equipment, Instructions…) ── */
  h2 {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    border-top: 1.5pt solid #000;
    padding-top: 5pt;
    margin-top: 16pt;
    margin-bottom: 8pt;
    page-break-after: avoid;
  }

  /* ── Sub-section headers (recipe sections) ── */
  h3 {
    font-size: 10.5pt;
    font-weight: 700;
    font-style: italic;
    margin-top: 12pt;
    margin-bottom: 4pt;
    page-break-after: avoid;
  }

  /* ── Mise en place label ── */
  h4 {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 6pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: 3pt;
    opacity: 0.55;
  }

  /* ── Meta bar ── */
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0 20pt;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 8.5pt;
    margin-bottom: 14pt;
    padding: 5pt 0;
    border-top: 0.5pt solid #999;
  }
  .meta-item { white-space: nowrap; }
  .meta-label {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 6.5pt;
    letter-spacing: 0.06em;
    margin-right: 3pt;
    opacity: 0.55;
  }

  /* ── Shopping list — 2 columns ── */
  .shopping-list ul {
    columns: 2;
    column-gap: 22pt;
    list-style: none;
    margin-top: 4pt;
  }
  .shopping-list li {
    break-inside: avoid;
    page-break-inside: avoid;
    padding: 1.5pt 0;
    font-size: 10pt;
  }
  .shopping-list li::before {
    content: "□  ";
    font-size: 9.5pt;
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* ── Equipment — inline comma-separated ── */
  .cookware-list {
    display: flex;
    flex-wrap: wrap;
    gap: 2pt 4pt;
    margin-top: 3pt;
    font-size: 9.5pt;
    font-style: italic;
  }
  .cookware-list .cw-item:not(:last-child)::after { content: ","; }

  /* ── Instructions ── */
  .instructions section {
    page-break-inside: avoid;
  }

  /* ── Section-level mise en place ── */
  .section-ingredients {
    border-left: 2pt solid #000;
    padding-left: 7pt;
    margin-bottom: 5pt;
  }
  .section-ingredients ul {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0 14pt;
    font-size: 9pt;
  }
  .section-ingredients li { white-space: nowrap; }
  .section-ingredients li::before { content: "· "; opacity: 0.5; }

  /* ── Steps ── */
  ol.steps {
    margin: 0;
    padding-left: 18pt;
  }
  ol.steps li {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 5pt;
    font-size: 10.5pt;
  }

  /* ── Action tag ── */
  .action {
    display: inline-block;
    font-family: 'Inter', system-ui, sans-serif;
    font-weight: 700;
    font-size: 6.5pt;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    border: 0.75pt solid #000;
    padding: 0.5pt 3pt 0pt;
    margin-right: 5pt;
    vertical-align: middle;
    white-space: nowrap;
  }

  /* ── Inline semantic tokens — B&W typographic distinction ── */
  .ingredient {
    font-weight: 700;
  }
  .reference {
    font-weight: 700;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 1.5pt;
    text-decoration-thickness: 0.75pt;
  }
  .cookware {
    font-style: italic;
  }
  .timer {
    font-weight: 700;
    border-bottom: 1pt solid #000;
    white-space: nowrap;
  }
  .timer.async {
    border-bottom-style: dashed;
  }
  .temp {
    font-weight: 700;
    white-space: nowrap;
  }
  .quantity { font-weight: normal; }
  .unit { opacity: 0.65; }
  .opt { opacity: 0.5; font-style: italic; }
  .declaration {
    font-size: 8pt;
    font-style: italic;
    opacity: 0.65;
  }
  .comment-step {
    list-style: none;
    margin-left: -18pt;
    font-style: italic;
    opacity: 0.6;
    font-size: 9.5pt;
  }

  /* ── Nutrition ── */
  .nutrition {
    margin-top: 14pt;
    font-size: 9pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .nut-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4pt 18pt;
    margin-top: 4pt;
  }
  .nut-item strong { font-size: 10.5pt; }
  .nut-item small { font-size: 8pt; opacity: 0.6; }

  /* Screen preview */
  @media screen {
    body {
      max-width: 760px;
      margin: 40px auto;
      padding: 40px 48px;
      font-size: 12pt;
      box-shadow: 0 2px 40px rgba(0,0,0,0.07);
      border: 1px solid #e5e5e5;
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
    caretRight: '→',
    arrowRight: '→',
    arrowUDownLeft: '↵',
    warning: '⚠',
    pencilSimple: '✎',
    clock: SVG.clock,
    fire: '△',
    knife: '—',
    scales: '⚖',
    clockCounterClockwise: '↺',
};

export function toPrintHTML(data: any, options: RendererOptions = {}): string {
    const registry = data.registry || { ingredients: {}, cookware: {} };
    const formatDuration = options.formatDuration || defaultFormatDuration;
    const context: RenderContext = {
        registry,
        icons: PRINT_ICONS,
        formatDuration,
        formatFraction: options.formatFraction,
    };
    // Context variant used when rendering inline step tokens — hides qty if flag is set
    const stepContext: RenderContext = options.hideStepQty
        ? { ...context, hideIngredientQty: true }
        : context;

    let body = '';

    // ── Title ──────────────────────────────────────────────────────────────
    if (data.title) {
        body += `<h1>${escapeHtml(data.title)}</h1>\n`;
    }

    // ── Meta bar ───────────────────────────────────────────────────────────
    body += `<div class="meta">\n`;
    if (data.metrics) {
        if (data.metrics.totalTime) {
            body += `  <span class="meta-item"><span class="meta-label">Total</span>${formatDuration(data.metrics.totalTime)}</span>\n`;
        }
        if (data.metrics.activeTime) {
            body += `  <span class="meta-item"><span class="meta-label">Active</span>${formatDuration(data.metrics.activeTime)}</span>\n`;
        }
        if (data.metrics.preparationTime) {
            body += `  <span class="meta-item"><span class="meta-label">Prep</span>${formatDuration(data.metrics.preparationTime)} <em style="opacity:0.55;font-size:0.85em">est.</em></span>\n`;
        }
    }
    if (data.meta) {
        for (const [k, v] of Object.entries(data.meta as Record<string, any>)) {
            if (k === 'title') continue;
            const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
            body += `  <span class="meta-item"><span class="meta-label">${escapeHtml(label)}</span>${escapeHtml(String(v))}</span>\n`;
        }
    }
    body += `</div>\n\n`;

    // ── Shopping list ──────────────────────────────────────────────────────
    if (data.shopping_list?.length > 0) {
        body += `<div class="shopping-list">\n<h2>Shopping List</h2>\n<ul>\n`;
        for (const item of data.shopping_list) {
            if (!item || typeof item !== 'object') continue;
            if (item.type === 'alternative' || item.type === 'group') {
                body += `  <li>${item.options.map((o: any) => formatElement(o, 'html', context)).join(' <em>or</em> ')}</li>\n`;
            } else if (item.type === 'composite') {
                body += `  <li>${formatElement(item, 'html', context)}</li>\n`;
                for (const u of item.usage ?? []) {
                    body += `  <li style="padding-left:12pt">${formatElement(u, 'html', context)}</li>\n`;
                }
            } else if (item.display) {
                body += `  <li>${escapeHtml(item.display)}</li>\n`;
            } else {
                body += `  <li>${formatElement(item, 'html', context)}</li>\n`;
            }
        }
        body += `</ul>\n</div>\n\n`;
    }

    // ── Equipment ─────────────────────────────────────────────────────────
    if (data.cookware?.length > 0) {
        body += `<div>\n<h2>Equipment</h2>\n<div class="cookware-list">\n`;
        for (const cw of data.cookware) {
            if (cw.type === 'alternative' || cw.type === 'group') {
                const opts = (cw.options ?? []).map((o: any) => formatElement(o, 'html', context)).join(' or ');
                body += `  <span class="cw-item">${opts}</span>\n`;
            } else {
                body += `  <span class="cw-item">${formatElement(cw, 'html', context)}</span>\n`;
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
                if (sec.retro_planning) titleHtml += ` <small style="opacity:0.55;font-size:0.8em">(${escapeHtml(sec.retro_planning)})</small>`;
                body += `  <h3>${titleHtml}</h3>\n`;
            }

            // Section-level ingredients — aggregated (dedup, addition, intermediates)
            const secItems = aggregateSectionIngredients(sec.ingredients ?? []).map(aggToRendererItem);
            if (secItems.length > 0) {
                body += `  <div class="section-ingredients"><ul>\n`;
                for (const ing of secItems) {
                    body += `    <li>${formatElement(ing, 'html', context)}</li>\n`;
                }
                body += `  </ul></div>\n`;
            }

            body += `  <ol class="steps">\n`;
            let stepCounter = 0;
            for (const stepItem of sec.steps ?? []) {
                if (!stepItem) continue;
                if (stepItem.type === 'comment') {
                    body += `    <li class="comment-step"><em>${escapeHtml(stepItem.value ?? '')}</em></li>\n`;
                    continue;
                }
                stepCounter++;
                body += `    <li value="${stepCounter}">\n`;

                if (stepItem.action) {
                    body += `      <span class="action">${escapeHtml(stepItem.action)}</span>`;
                }

                let stepContent = '';
                if (stepItem.type === 'text') {
                    stepContent = escapeHtml(stepItem.value ?? '');
                } else {
                    stepContent = (stepItem.content ?? []).map((c: any, i: number, arr: any[]) => {
                        let str = formatElement(c, 'html', stepContext);
                        const isToken = c && typeof c === 'object' && c.type !== 'text' && c.type !== 'comment';
                        if (isToken) {
                            const next = arr[i + 1];
                            if (next) {
                                const nextChar = typeof next === 'string'
                                    ? next.charAt(0)
                                    : next.type === 'text' ? (next.value ?? '').charAt(0) : '';
                                if (nextChar && !/^[.,!?:;)\s]/.test(nextChar)) str += ' ';
                            }
                        }
                        return str;
                    }).join('');
                }

                body += stepContent ? `      ${stepContent}\n` : '';
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
        const portionNote = nut.perPortion ? ' (per portion)' : '';
        if (vals && vals.calories > 0) {
            body += `<div class="nutrition">\n<h2>Nutrition${escapeHtml(portionNote)}</h2>\n<div class="nut-grid">\n`;
            body += `  <span class="nut-item"><strong>${Math.round(vals.calories)}</strong> <small>kcal</small></span>\n`;
            body += `  <span class="nut-item"><small>Protein</small> <strong>${vals.protein}g</strong></span>\n`;
            body += `  <span class="nut-item"><small>Carbs</small> <strong>${vals.carbs}g</strong></span>\n`;
            body += `  <span class="nut-item"><small>Fat</small> <strong>${vals.fat}g</strong></span>\n`;
            if (vals.fiber != null) body += `  <span class="nut-item"><small>Fiber</small> <strong>${vals.fiber}g</strong></span>\n`;
            if (vals.salt != null || vals.sodium != null) {
                const saltVal = vals.salt ?? vals.sodium;
                body += `  <span class="nut-item"><small>Salt</small> <strong>${saltVal}g</strong></span>\n`;
            }
            body += `</div>\n</div>\n`;
        }
    }

    // ── Full HTML document ─────────────────────────────────────────────────
    const titleTag = data.title ? `<title>${escapeHtml(data.title)}</title>` : '<title>Recipe</title>';
    return `<!DOCTYPE html>
<html lang="${escapeHtml((data.meta as any)?.language ?? 'en')}">
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
