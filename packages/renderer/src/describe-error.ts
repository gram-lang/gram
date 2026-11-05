import { getDictionary } from "@gram-lang/i18n";

/**
 * What `describeError` reads of a diagnostic: the warnings of the pipeline
 * (`Warning` of kitchen) fit, and so do the diagnostics a surface builds from
 * them, which it gets back untouched.
 */
export interface DescribableDiagnostic {
	code?: string;
	message: string;
	severity?: "error" | "warning" | "info";
	/** An error that stops the views (a parse or compile failure). */
	blocking?: boolean;
	/** Offsets in the source of `uri`, or of the open document without it. */
	loc?: { start: number; end: number };
	/** The module the diagnostic comes from, in a recipe made of several files. */
	uri?: string;
}

/** The error to show when the views of a recipe are paused: data, never markup. */
export interface ErrorDescription<D extends DescribableDiagnostic> {
	/** What happened to the views, in the language asked for. */
	title: string;
	/** Why, in a sentence. */
	description: string;
	/** The primary diagnostic, as it was given. */
	diagnostic: D;
	code: string | undefined;
	message: string;
	/** The module it comes from, when it is not the open document. */
	uri: string | undefined;
	/** Where it is, in offsets: what a "show the error" button jumps to. */
	range: { start: number; end: number } | undefined;
}

/**
 * The error a surface shows when the views of a recipe stop: the first
 * blocking diagnostic, else the first error, else the first diagnostic.
 * `null` when there is none.
 */
export function describeError<D extends DescribableDiagnostic>(
	diagnostics: readonly D[],
	lang?: string,
): ErrorDescription<D> | null {
	const primary =
		diagnostics.find((d) => d.blocking) ??
		diagnostics.find((d) => d.severity === "error") ??
		diagnostics[0];
	if (!primary) return null;
	const t = getDictionary(lang).renderer;
	return {
		title: t.viewsPaused,
		description: t.viewsPausedDescription,
		diagnostic: primary,
		code: primary.code,
		message: primary.message,
		uri: primary.uri,
		range: primary.loc
			? { start: primary.loc.start, end: primary.loc.end }
			: undefined,
	};
}
