/** The print styles of the production sheet, added to the print stylesheet. */
export const RUN_SHEET_PRINT_CSS = `
  .gram-run-sheet h2 { font-size: 16pt; margin-bottom: 4pt; }
  .gram-run-sheet .run-sheet-served { color: var(--grey); margin-bottom: 14pt; }
  .gram-run-sheet h3 { font-size: 12pt; margin: 14pt 0 6pt; border-bottom: 1px solid var(--light-grey); padding-bottom: 2pt; }
  .gram-run-sheet ul { list-style: none; }
  .gram-run-sheet .run-sheet-entry { margin-bottom: 6pt; page-break-inside: avoid; }
  .gram-run-sheet .run-sheet-when { display: inline-block; min-width: 9em; color: var(--grey); }
  .gram-run-sheet .run-sheet-entry.passive .run-sheet-title { font-style: italic; }
  .gram-run-sheet .run-sheet-entry.active .run-sheet-title { font-weight: 700; }
  .gram-run-sheet .run-sheet-detail, .gram-run-sheet .run-sheet-note { margin-left: 9em; color: var(--dark-grey); font-size: 9pt; }
  .gram-run-sheet .run-sheet-note { font-weight: 700; }
  .gram-run-sheet .run-sheet-problems li { margin-left: 1em; list-style: disc; }
  .plan-summary { border: 1px solid var(--light-grey); padding: 6pt 10pt; margin: 0 0 12pt; }
  .plan-summary .plan-served { font-weight: 700; }
  .plan-summary .plan-problems li { margin-left: 1em; list-style: disc; }
  .steps li.step-day { list-style: none; font-weight: 700; margin: 10pt 0 4pt -1.5em; }
  .step-plan { margin: 2pt 0 0; color: var(--grey); font-size: 9pt; }
  .step-plan .step-note { color: var(--dark-grey); font-weight: 700; }
`;
