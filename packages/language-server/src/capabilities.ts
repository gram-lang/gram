import {
	type ServerCapabilities,
	TextDocumentSyncKind,
} from "vscode-languageserver/node";
import type { ClientProfile } from "./client-profile";
import {
	SEMANTIC_TOKEN_MODIFIERS,
	SEMANTIC_TOKEN_TYPES,
} from "./features/semantic-tokens";
import { describeOutputs } from "./views";

/**
 * What the server announces in its `initialize` result, for this client in
 * the editor's language. Pure: the profile is read once at `initialize`.
 */
export function serverCapabilities(
	profile: ClientProfile,
	locale: string | undefined,
): ServerCapabilities {
	const capabilities: ServerCapabilities = {
		textDocumentSync: TextDocumentSyncKind.Incremental,
		documentSymbolProvider: true,
		definitionProvider: true,
		hoverProvider: true,
		foldingRangeProvider: true,
		completionProvider: { triggerCharacters: ["&", "@", '"'] },
		semanticTokensProvider: {
			full: true,
			legend: {
				tokenTypes: SEMANTIC_TOKEN_TYPES as unknown as string[],
				tokenModifiers: SEMANTIC_TOKEN_MODIFIERS,
			},
		},
		referencesProvider: true,
		renameProvider: { prepareProvider: true },
		documentFormattingProvider: true,
		codeActionProvider: true,
		inlayHintProvider: true,
	};
	if (profile.views !== "protocol") return capabilities;
	return {
		...capabilities,
		// The lens runs `gram.showPreview`, a command of the VS Code
		// extension: a client without the views protocol has nothing to run.
		codeLensProvider: { resolveProvider: false },
		// What a client of the views protocol can open, named in the
		// editor's language: it builds its choice of views from this, so
		// a view added to the renderer appears there with no edit.
		experimental: { gramViews: describeOutputs(locale) },
	};
}
