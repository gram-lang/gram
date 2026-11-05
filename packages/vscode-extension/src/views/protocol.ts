/*
 * The views protocol of the language server, as the extension reads it. The
 * server is the source of truth (`packages/language-server/src/views.ts`);
 * these are the shapes it sends.
 */

/** One output the server can render, from `capabilities.experimental.gramViews`. */
export interface OutputInfo {
	id: string;
	kind: "renderer" | "inspector";
	/** Its name, in the editor's language. */
	label: string;
	presentation?: "code" | "tree";
	/** What a view reads from the plan; `runSheet` means it is laid out in time. */
	needs?: string[];
}

/** The words of the serving time controls, in the editor's language. */
export interface ServingStrings {
	label: string;
	clear: string;
	clearTitle: string;
	suggest: string;
	none: string;
	whyNot: string;
	/** "Earliest: {when}". */
	earliest: string;
}

/** What the server says the extension can show, and the words it writes around it. */
export interface ViewsCapability {
	outputs: OutputInfo[];
	strings: { showError: string; outputEmpty: string; serving?: ServingStrings };
}

/**
 * Whether an output is laid out in time, and so shows the serving time
 * controls: read from what it needs, never from its id, so a new view laid
 * out in time gets them too.
 */
export const isPlanned = (output: OutputInfo): boolean =>
	output.kind === "renderer" && (output.needs ?? []).includes("runSheet");

/** The answer of `gram/serveTimes`: the serving times to propose, in words. */
export interface ServeSuggestions {
	candidates: { serveAt: string; label: string; title: string }[];
	rejected: string[];
	earliest: { serveAt: string; label: string; text: string } | null;
}

/**
 * What the cook chose for one recipe this sitting, sent in `gram/setSession`.
 * Kept per document while VS Code is open, never written to the settings.
 */
export interface Session {
	/** A local date-time, "2026-10-11T13:00", in the project's time zone. */
	serveAt?: string;
}

const SERVE_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A serving time from the page ("2026-10-11T13:00"), or `undefined` for anything else. */
export function readServeAt(value: unknown): string | undefined {
	return typeof value === "string" && SERVE_AT.test(value) ? value : undefined;
}

/** Why an output is paused: the recipe has an error that stops the views. */
export interface PausedError {
	title: string;
	description: string;
	code?: string;
	message: string;
	/** The module the error is in, when it is not the document itself. */
	uri?: string;
	/** In offsets into `uri`, or into the document. */
	range?: { start: number; end: number };
}

export interface InspectorPayload {
	presentation: "code" | "tree";
	language?: string;
	text: string;
}

/** `gram/viewUpdated`. */
export type ViewUpdate =
	| {
			uri: string;
			outputId: string;
			kind: OutputInfo["kind"];
			state: "ok";
			payload: string | InspectorPayload | null;
	  }
	| {
			uri: string;
			outputId: string;
			kind: OutputInfo["kind"];
			state: "paused";
			error: PausedError;
	  };

/** What a panel shows, made from the last `ok` update of its output. */
export type Content =
	| { type: "html"; html: string }
	| { type: "empty" }
	| { type: "code"; language?: string; text: string }
	| { type: "tree"; html: string };

/** The content of an `ok` update, as a panel shows it. */
export function contentOf(payload: string | InspectorPayload | null): Content {
	if (payload === null) return { type: "empty" };
	if (typeof payload === "string") return { type: "html", html: payload };
	if (payload.presentation === "tree")
		return { type: "tree", html: payload.text };
	return {
		type: "code",
		text: payload.text,
		...(payload.language && { language: payload.language }),
	};
}

/**
 * The capability of the `initialize` result, or `undefined` from a server that
 * does not speak the views protocol.
 */
export function readViewsCapability(
	initializeResult: unknown,
): ViewsCapability | undefined {
	const views = (
		initializeResult as
			| { capabilities?: { experimental?: { gramViews?: unknown } } }
			| undefined
	)?.capabilities?.experimental?.gramViews as ViewsCapability | undefined;
	if (!views || !Array.isArray(views.outputs)) return undefined;
	return views;
}
