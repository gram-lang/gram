/** The print styles of the work plan, added to the print stylesheet. */
export const RUN_SHEET_PRINT_CSS = `
  .gram-run-sheet .work-plan-header { border-top: 2pt solid #000; page-break-after: avoid; padding-top: 8pt; }
  .gram-run-sheet h2 { font-size: 18pt; font-weight: 800; margin-top: 0; margin-bottom: 4pt; }
  .gram-run-sheet .work-plan-subtitle { color: var(--grey); margin-bottom: 6pt; }
  .gram-run-sheet .work-plan-summary { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; border-top: 0.5pt solid #000; border-bottom: 0.5pt solid #000; padding: 4pt 0; margin-bottom: 10pt; }
  .gram-run-sheet ul, .gram-run-sheet ol { list-style: none; }
  .gram-run-sheet .work-plan-schedule { margin: 0 0 4pt; border: 0.75pt solid #000; }
  .gram-run-sheet .work-plan-schedule li { margin-bottom: 0; }
  .gram-run-sheet .schedule-group { display: grid; grid-template-columns: 4.5em 1fr; border-top: 0.75pt solid #000; page-break-inside: avoid; }
  .gram-run-sheet .schedule-group:first-child { border-top: 0; }
  .gram-run-sheet .schedule-day { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 800; text-transform: uppercase; padding: 4pt 6pt; border-right: 0.75pt solid #000; }
  .gram-run-sheet .schedule-day small { display: block; font-weight: 400; color: var(--grey); text-transform: none; }
  .gram-run-sheet .schedule-rows { padding: 3pt 6pt; }
  .gram-run-sheet .schedule-row { display: grid; grid-template-columns: 8em 1fr; column-gap: 6pt; padding: 1.5pt 0; border-bottom: 0.5pt dotted #999; }
  .gram-run-sheet .schedule-row:last-child { border-bottom: 0; }
  .gram-run-sheet .schedule-time { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; font-weight: 600; }
  .gram-run-sheet .schedule-visit .schedule-time::before { content: ""; display: inline-block; width: 5pt; height: 5pt; background: #000; margin-right: 4pt; }
  .gram-run-sheet .schedule-visit .schedule-text { font-weight: 600; }
  .gram-run-sheet .schedule-line { border-left: 1.5pt dotted var(--grey); margin-left: 2pt; min-height: 10pt; }
  .gram-run-sheet .schedule-thread { font-style: italic; color: var(--grey); }
  .gram-run-sheet .schedule-serve .schedule-text { font-weight: 800; text-transform: uppercase; }
  .gram-run-sheet .work-plan-legend { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 7.5pt; color: var(--grey); }
  .gram-run-sheet .legend-thread { margin-left: 12pt; }
  .gram-run-sheet .work-plan-day { border: 1pt solid #000; padding: 10pt 12pt; margin-bottom: 12pt; page-break-before: always; page-break-inside: avoid; }
  .gram-run-sheet .work-plan-day h3 { font-size: 13pt; font-weight: 800; margin: 0 0 8pt; border-bottom: 1.5pt solid #000; padding-bottom: 3pt; display: block; text-transform: uppercase; }
  .gram-run-sheet .work-plan-day .day-slot { float: right; text-transform: none; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; font-weight: 700; color: var(--grey); }
  .gram-run-sheet .work-plan-visit h4 { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: var(--grey); margin: 10pt 0 3pt; }
  .gram-run-sheet .work-plan-notice { font-weight: 700; margin: 6pt 0; }
  .gram-run-sheet .work-plan-notice::before { content: "⚠ "; }
  .gram-run-sheet .work-plan-margin { color: var(--grey); }
  .gram-run-sheet .work-plan-kit, .gram-run-sheet .program-kit { border: 0.75pt solid #000; padding: 4pt 8pt 6pt; page-break-inside: avoid; }
  .gram-run-sheet .work-plan-kit h4 { margin-top: 0; }
  .gram-run-sheet .kit-group { page-break-inside: avoid; }
  .gram-run-sheet .kit-group + .kit-group { margin-top: 5pt; padding-top: 5pt; border-top: 0.5pt dotted #000; }
  .gram-run-sheet .kit-section-title { margin: 0 0 3pt; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: var(--grey); }
  .gram-run-sheet .kit-list { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16pt; }
  .gram-run-sheet .kit-list + .kit-list.kit-tools { margin-top: 5pt; padding-top: 5pt; border-top: 0.5pt dotted #000; }
  .gram-run-sheet .work-plan-kit li, .gram-run-sheet .program-kit li { margin-bottom: 2pt; page-break-inside: avoid; }
  .gram-run-sheet .work-plan-kit label > span, .gram-run-sheet .program-kit label > span { display: inline-flex; justify-content: space-between; width: calc(100% - 14pt); gap: 6pt; }
  .gram-run-sheet .work-plan-kit input[type="checkbox"], .gram-run-sheet .program-kit input[type="checkbox"] { appearance: none; -webkit-appearance: none; width: 8pt; height: 8pt; border: 1pt solid #000; border-radius: 1pt; margin-right: 6pt; vertical-align: -1pt; }
  .gram-run-sheet .kit-qty::before, .gram-run-sheet .kit-note::before, .gram-run-sheet .kit-tools label > span::after { content: ""; flex: 1; align-self: flex-end; min-width: 8pt; margin-bottom: 2pt; border-bottom: 1pt dotted #000; }
  .gram-run-sheet .work-plan-program > ul { border: 0.75pt solid #000; }
  .gram-run-sheet .work-plan-program > ul > li { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2pt 10pt; padding: 4pt 6pt; border-bottom: 0.75pt solid #000; page-break-inside: avoid; }
  .gram-run-sheet .work-plan-program > ul > li:last-child { border-bottom: 0; }
  .gram-run-sheet .program-section { font-weight: 700; text-transform: uppercase; }
  .gram-run-sheet .program-by-section > ul { border: 0; }
  .gram-run-sheet .program-by-section > ul > li { padding: 0 0 6pt; border: 0; }
  .gram-run-sheet .program-by-section .program-kit { flex-basis: 100%; margin-top: 3pt; }
  .gram-run-sheet .program-ref { font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--grey); font-size: 7.5pt; }
  .gram-run-sheet .kit-qty, .gram-run-sheet .kit-note { display: flex; flex: 1; justify-content: flex-end; gap: 4pt; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; color: var(--grey); }
  .gram-run-sheet .work-plan-leaving { border: 1pt dashed #000; padding: 5pt 8pt; page-break-inside: avoid; }
  .gram-run-sheet .work-plan-leaving h4 { margin-top: 0; }
  .gram-run-sheet .work-plan-leaving ul { margin-left: 2pt; padding-left: 8pt; border-left: 1.5pt dotted #000; }
  .gram-run-sheet .work-plan-leaving li { display: flex; align-items: baseline; gap: 4pt; margin-bottom: 2pt; }
  .gram-run-sheet .work-plan-leaving li::after { content: ""; order: 1; flex: 1; align-self: flex-end; min-width: 8pt; margin-bottom: 2pt; border-bottom: 1pt dotted #000; }
  .gram-run-sheet .wait-length { order: 2; padding: 0 3pt; border: 0.75pt solid #000; border-radius: 1pt; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8pt; font-weight: 600; }
  .gram-run-sheet .wait-until { font-size: 8pt; font-style: italic; color: var(--grey); }
  .gram-run-sheet .leaving-next { background: #000; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; padding: 4pt 8pt; margin: 4pt 0 0; page-break-inside: avoid; }
  .gram-run-sheet .work-plan-problems { border: 1pt solid #000; padding: 6pt 9pt; margin: 0 0 10pt; background: #fafafa; page-break-inside: avoid; }
  .gram-run-sheet .work-plan-problems h3 { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; margin: 0 0 3pt; display: flex; align-items: center; gap: 4pt; }
  .gram-run-sheet .work-plan-problems .problem-icon { display: inline-flex; align-items: center; }
  .gram-run-sheet .work-plan-problems ul { margin: 0; padding: 0; }
  .gram-run-sheet .work-plan-problems li { margin-left: 1.2em; list-style: disc; margin-bottom: 2pt; font-size: 8.5pt; }
  .gram-run-sheet .work-plan-problems li:last-child { margin-bottom: 0; }
`;
