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
}

/** What the server says the extension can show, and the words it writes around it. */
export interface ViewsCapability {
	outputs: OutputInfo[];
	strings: { showError: string; outputEmpty: string };
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
