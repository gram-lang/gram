/** The print styles of the work plan, added to the print stylesheet. */
export const RUN_SHEET_PRINT_CSS = `
  .gram-run-sheet h2 { font-size: 16pt; margin-top: 0; margin-bottom: 4pt; }
  .gram-run-sheet .work-plan-subtitle, .gram-run-sheet .work-plan-summary { color: var(--grey); margin-bottom: 2pt; }
  .gram-run-sheet ul, .gram-run-sheet ol { list-style: none; }
  .gram-run-sheet .work-plan-schedule { margin: 12pt 0 4pt; }
  .gram-run-sheet .work-plan-schedule li { margin-bottom: 2pt; }
  .gram-run-sheet .schedule-day { display: inline-block; min-width: 4.5em; font-weight: 700; }
  .gram-run-sheet .schedule-time { display: inline-block; min-width: 8.5em; color: var(--grey); }
  .gram-run-sheet .schedule-thread { padding-left: 13em; font-style: italic; color: var(--grey); }
  .gram-run-sheet .schedule-serve .schedule-text { font-weight: 700; }
  .gram-run-sheet .work-plan-day { page-break-before: always; }
  .gram-run-sheet .work-plan-day h3 { font-size: 12pt; margin: 14pt 0 6pt; border-bottom: 1px solid var(--light-grey); padding-bottom: 2pt; display: block; text-transform: capitalize; }
  .gram-run-sheet .work-plan-day .day-slot { float: right; font-weight: 400; color: var(--grey); }
  .gram-run-sheet .work-plan-passage h4 { font-family: 'Inter', system-ui, sans-serif; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.15em; color: var(--grey); margin: 10pt 0 3pt; }
  .gram-run-sheet .work-plan-notice { font-weight: 700; margin: 6pt 0; }
  .gram-run-sheet .work-plan-notice::before { content: "⚠ "; }
  .gram-run-sheet .work-plan-margin { color: var(--grey); }
  .gram-run-sheet .work-plan-kit li { margin-bottom: 3pt; page-break-inside: avoid; }
  .gram-run-sheet .work-plan-kit input[type="checkbox"] { width: 9pt; height: 9pt; margin-right: 4pt; vertical-align: -1pt; }
  .gram-run-sheet .work-plan-program li { margin-bottom: 4pt; page-break-inside: avoid; }
  .gram-run-sheet .program-steps { display: block; color: var(--dark-grey); font-size: 9pt; }
  .gram-run-sheet .work-plan-problems li { margin-left: 1em; list-style: disc; }
`;
