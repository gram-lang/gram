import { RendererOptions, RenderContext } from '../types';
import { formatDuration as defaultFormatDuration, escapeHtml, formatQuantityValue } from '../utils';
import { formatElement } from './element';

const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4;
    margin: 18mm 22mm 18mm 22mm;
  }

  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #000;
    background: #fff;
  }

  h1 {
    font-size: 20pt;
    font-weight: bold;
    letter-spacing: -0.02em;
    margin-bottom: 6pt;
    page-break-after: avoid;
  }

  h2 {
    font-size: 13pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1pt solid #000;
    padding-bottom: 2pt;
    margin-top: 14pt;
    margin-bottom: 8pt;
    page-break-after: avoid;
  }

  h3 {
    font-size: 11pt;
    font-weight: bold;
    font-style: italic;
    margin-top: 10pt;
    margin-bottom: 4pt;
    page-break-after: avoid;
  }

  /* ── Meta bar ── */
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0 24pt;
    font-size: 9.5pt;
    color: #333;
    margin-bottom: 12pt;
    padding-bottom: 8pt;
    border-bottom: 0.5pt solid #ccc;
  }
  .meta-item { white-space: nowrap; }
  .meta-label { font-style: italic; margin-right: 3pt; }

  /* ── Shopping list — 2 columns ── */
  .shopping-list ul {
    columns: 2;
    column-gap: 20pt;
    list-style: none;
    margin-top: 4pt;
  }
  .shopping-list li {
    break-inside: avoid;
    page-break-inside: avoid;
    padding: 1.5pt 0;
    font-size: 10.5pt;
  }
  .shopping-list li::before {
    content: "☐  ";
    font-size: 10pt;
  }
  .shopping-list .qty { color: #444; }

  /* ── Cookware ── */
  .cookware-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4pt 10pt;
    margin-top: 4pt;
    font-size: 10pt;
  }
  .cookware-list .cw-item::after { content: ","; }
  .cookware-list .cw-item:last-child::after { content: ""; }

  /* ── Instructions ── */
  .instructions section {
    page-break-inside: avoid;
  }
  .section-ingredients {
    font-size: 9.5pt;
    color: #333;
    margin-bottom: 4pt;
    font-style: italic;
  }
  .section-ingredients ul {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0 10pt;
  }
  .section-ingredients li::before { content: "· "; }

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
  ol.steps li .action {
    font-weight: bold;
    text-transform: uppercase;
    font-size: 8pt;
    letter-spacing: 0.08em;
    margin-right: 4pt;
  }
  /* Inline element styles — no color, just typographic weight */
  .ingredient, .reference { font-weight: bold; }
  .cookware { font-style: italic; }
  .timer, .temp { font-variant-numeric: tabular-nums; }
  .quantity { font-weight: normal; }
  .opt { opacity: 0.6; }
  .comment-step { list-style: none; margin-left: -18pt; font-style: italic; color: #555; font-size: 10pt; }

  /* ── Nutrition ── */
  .nutrition {
    margin-top: 14pt;
    font-size: 9.5pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .nutrition h2 { font-size: 10pt; }
  .nut-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4pt 14pt;
    margin-top: 4pt;
  }
  .nut-item strong { font-size: 11pt; }
  .nut-item small { font-size: 8pt; color: #555; }

  /* Print-safe: hide anything that shouldn't print */
  @media screen { body { max-width: 800px; margin: 20px auto; padding: 20px; } }
`;

const PRINT_ICONS = {
    hourglass: '⏳',
    timer: '⏱',
    thermometer: '🌡',
    caretRight: '→',
    arrowRight: '→',
    arrowUDownLeft: '↵',
    warning: '⚠',
    pencilSimple: '✏',
    clock: '⏱',
    fire: '🔥',
    knife: '🔪',
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

    let body = '';

    // ── Title ──────────────────────────────────────────────────────────────
    if (data.title) {
        body += `<h1>${escapeHtml(data.title)}</h1>\n`;
    }

    // ── Meta bar ───────────────────────────────────────────────────────────
    body += `<div class="meta">\n`;
    if (data.metrics) {
        if (data.metrics.totalTime) {
            body += `  <span class="meta-item"><span class="meta-label">Total:</span>${formatDuration(data.metrics.totalTime)}</span>\n`;
        }
        if (data.metrics.activeTime) {
            body += `  <span class="meta-item"><span class="meta-label">Active:</span>${formatDuration(data.metrics.activeTime)}</span>\n`;
        }
        if (data.metrics.preparationTime) {
            body += `  <span class="meta-item"><span class="meta-label">Prep:</span>${formatDuration(data.metrics.preparationTime)} (est.)</span>\n`;
        }
    }
    if (data.meta) {
        for (const [k, v] of Object.entries(data.meta as Record<string, any>)) {
            if (k === 'title') continue;
            const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
            body += `  <span class="meta-item"><span class="meta-label">${escapeHtml(label)}:</span>${escapeHtml(String(v))}</span>\n`;
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

    // ── Cookware ───────────────────────────────────────────────────────────
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
                if (sec.retro_planning) titleHtml += ` <small>(${escapeHtml(sec.retro_planning)})</small>`;
                body += `  <h3>${titleHtml}</h3>\n`;
            }

            // Section-level ingredients (mise en place)
            const secIngs = (sec.ingredients ?? []).filter((i: any) => i.qty != null && i.type !== 'alternative');
            if (secIngs.length > 0) {
                body += `  <div class="section-ingredients"><ul>\n`;
                for (const ing of secIngs) {
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
                        let str = formatElement(c, 'html', context);
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

                // Inline timers from backgroundTasks
                if (stepItem.backgroundTasks?.length > 0) {
                    const timerTexts = stepItem.backgroundTasks.map((t: any) =>
                        `⏳ ${t.name ? escapeHtml(t.name) + ': ' : ''}${formatDuration(t.duration)}`
                    );
                    body += `      <span class="timer" style="font-size:9pt;margin-left:6pt">${timerTexts.join(' · ')}</span>\n`;
                }

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

    // ── Wrap in full HTML document ─────────────────────────────────────────
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
