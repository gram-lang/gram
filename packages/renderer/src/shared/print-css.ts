import css from "./print.css" with { type: "text" };

/** The base of every printed view (`shared/print.css`): each view adds its own styles after it. */
export const PRINT_BASE_CSS: string = css;
