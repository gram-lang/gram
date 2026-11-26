/**
 * The shapes `lintDocument` returns: one list of diagnostics, the same for the
 * language server and `gram check`. Offsets are UTF-16 code units into the
 * file's source, the unit of Ohm.js and of LSP.
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */

/**
 * One replacement in a file's text.
 *
 * @experimental
 */
export interface TextPatch {
	start: number;
	end: number;
	replacement: string;
}

/**
 * What a fix does to one file: patch its text, or create it.
 *
 * @experimental
 */
export type FileEdit =
	| { kind: "patch"; uri: string; patches: TextPatch[] }
	| { kind: "createFile"; uri: string; content: string };

/**
 * One way to fix a diagnostic.
 *
 * @experimental
 */
export interface LintFix {
	title: string;
	edits: FileEdit[];
	/**
	 * The fix that leaves no doubt about the intent: an editor offers it
	 * first, and `gram check --fix` applies only these.
	 */
	isPreferred?: boolean;
}

/**
 * `hint` never blocks, even under `--strict`.
 *
 * @experimental
 */
export type LintSeverity = "error" | "warning" | "info" | "hint";

/**
 * Where the cause of a diagnostic really is, when it lies in another file
 * (a dependency pulled in by `@use`).
 *
 * @experimental
 */
export interface LintRelated {
	uri: string;
	/** Absent: the top of that file. */
	loc?: { start: number; end: number };
	message: string;
}

/**
 * One diagnostic of a checked document.
 *
 * @experimental
 */
export interface LintDiagnostic {
	code: string;
	severity: LintSeverity;
	/** The file the diagnostic is shown in: the checked document. */
	uri: string;
	/** Absent: anchored at the top of the file (`MISSING_TITLE`, say). */
	loc?: { start: number; end: number };
	message: string;
	/** The compact facts of a compiler warning (`Warning.data`). */
	data?: Record<string, unknown>;
	/** The code's section of the warnings reference page. */
	docUrl?: string;
	/** The diagnostic flags a deprecated form, written right here: an editor strikes it through. */
	deprecated?: true;
	/** The real position when the cause lies in another file. */
	related?: LintRelated[];
	fixes?: LintFix[];
}
