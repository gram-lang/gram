/**
 * Where the mise en place goes in a timeline: right before each section, all
 * of it at the start, or at the start of each working day. Every package that
 * lets the reader pick one (renderer, CLI, language server, playground) reads
 * its choices, default and validation from here.
 */
export const MISE_EN_PLACE_MODES = [
	"perSection",
	"upfront",
	"perSession",
] as const;

export type MiseEnPlaceMode = (typeof MISE_EN_PLACE_MODES)[number];

/** Preparation right before each section, unless the reader picks otherwise. */
export const DEFAULT_MISE_EN_PLACE_MODE: MiseEnPlaceMode = "perSection";

/** Narrows untrusted input (a saved choice, a setting) to a known mode. */
export const isMiseEnPlaceMode = (value: unknown): value is MiseEnPlaceMode =>
	(MISE_EN_PLACE_MODES as readonly unknown[]).includes(value);

/**
 * How long a passive rest written as a range lasts (`~_{12-24h}`): the
 * shortest it can be, the middle, or the longest. A rest without a range is
 * unaffected, and so is an active timer (`~{20-25min}`, always planned on its
 * longest figure so dinner is never late).
 */
export const REST_CHOICES = ["shortest", "balanced", "longest"] as const;

export type RestChoice = (typeof REST_CHOICES)[number];

/** The shortest rest, unless the reader picks otherwise. */
export const DEFAULT_REST_CHOICE: RestChoice = "shortest";

/** Narrows untrusted input (a saved choice, a setting) to a known choice. */
export const isRestChoice = (value: unknown): value is RestChoice =>
	(REST_CHOICES as readonly unknown[]).includes(value);
