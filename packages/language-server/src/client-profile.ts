import type { InitializeParams } from "vscode-languageserver/node";

/**
 * How a client wants the views of a document:
 *
 * - `protocol`: it declared the views protocol (`views: true`); it receives
 *   only the outputs it has open, in `gram/viewUpdated`.
 * - `off`: it wants no view at all (`views: false`), an editor with no panel.
 * - `legacy`: it said nothing; an older client that keeps receiving the
 *   preview and the run sheet of every document until 2.0.
 */
export type ViewsMode = "protocol" | "legacy" | "off";

/**
 * What the client declared at `initialize`, read once: every decision of the
 * server (the capabilities it announces, what it renders, the requests it
 * sends) derives from this, never from the raw parameters.
 */
export interface ClientProfile {
	views: ViewsMode;
	/** `capabilities.workspace.configuration`: it answers `workspace/configuration`. */
	configuration: boolean;
	/** `workspace.didChangeWatchedFiles.dynamicRegistration`: it accepts a file watcher registration. */
	watchedFiles: boolean;
	/** `workspace.inlayHint.refreshSupport`: it accepts `workspace/inlayHint/refresh`. */
	inlayHintRefresh: boolean;
	/** `textDocument.completion.completionItem.snippetSupport`: it expands snippet completions. */
	snippets: boolean;
}

function viewsModeOf(options: unknown): ViewsMode {
	const views =
		typeof options === "object" && options !== null
			? (options as { views?: unknown }).views
			: undefined;
	if (views === true) return "protocol";
	if (views === false) return "off";
	// @remove-in: 2.0.0 [lsp-legacy-view-notifications]
	return "legacy";
}

export function clientProfileOf(params: InitializeParams): ClientProfile {
	const workspace = params.capabilities?.workspace;
	return {
		views: viewsModeOf(params.initializationOptions),
		configuration: workspace?.configuration === true,
		watchedFiles:
			workspace?.didChangeWatchedFiles?.dynamicRegistration === true,
		inlayHintRefresh: workspace?.inlayHint?.refreshSupport === true,
		snippets:
			params.capabilities?.textDocument?.completion?.completionItem
				?.snippetSupport === true,
	};
}
