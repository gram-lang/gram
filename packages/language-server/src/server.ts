import {
	createConnection,
	ProposedFeatures,
	TextDocuments,
	type InitializeParams,
	type InitializeResult,
	TextDocumentSyncKind,
	DidChangeWatchedFilesNotification,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseDocument, type DocumentState } from "./document-state";
import { provideDocumentSymbols } from "./features/document-symbols";
import { provideDiagnostics } from "./features/diagnostics";
import { provideDefinition } from "./features/go-to-definition";
import { provideHover } from "./features/hover";
import { provideFoldingRanges } from "./features/folding-ranges";
import { provideCompletions } from "./features/completions";
import { provideReferences } from "./features/references";
import { prepareName, provideRename } from "./features/rename";
import { provideFormatting } from "./features/formatting";
import { provideCodeActions } from "./features/code-actions";
import {
	provideSemanticTokens,
	SEMANTIC_TOKEN_TYPES,
	SEMANTIC_TOKEN_MODIFIERS,
} from "./features/semantic-tokens";
import type { IngredientDB } from "./ingredient-loader";
import { provideInlayHints } from "./features/inlay-hints";
import { provideCodeLenses } from "./features/code-lens";
import { positionToOffset } from "./utils/position";
import { resolveWorkspaceFolders } from "./utils/workspace-folders";
import { resolveFreshState } from "./utils/fresh-state";
import { reloadDbAndRefreshDiagnostics as computeDbReload } from "./utils/db-reload";
import { toHTML, escapeHtml } from "@gram-lang/renderer";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const states = new Map<string, DocumentState>();

// A crash here kills the editor's whole language feature set, not just one
// command — the bar for "never die" is higher than for the CLI. These are a
// last resort behind the specific fixes elsewhere in this file: log and keep
// serving requests instead of letting Node exit.
process.on("uncaughtException", (err) => {
	connection.console.error(
		`Uncaught exception: ${err instanceof Error ? (err.stack ?? err.message) : err}`,
	);
});
process.on("unhandledRejection", (reason) => {
	connection.console.error(
		`Unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : reason}`,
	);
});

let ingredientDB: IngredientDB = {};
let ingredientLookupSet: Set<string> = new Set();
let workspaceFolders: string[] = [];

connection.onInitialize((params: InitializeParams): InitializeResult => {
	workspaceFolders = resolveWorkspaceFolders(params.workspaceFolders);
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			documentSymbolProvider: true,
			definitionProvider: true,
			hoverProvider: true,
			foldingRangeProvider: true,
			completionProvider: { triggerCharacters: ["&", "@"] },
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
			codeLensProvider: { resolveProvider: false },
		},
	};
});

// Called from onDidChangeWatchedFiles/
// onDidChangeConfiguration without awaiting or catching the returned
// promise. This function must never reject — every call site treats it as
// fire-and-forget, and an unhandled rejection here would otherwise crash the
// whole Node process (Node terminates on unhandled rejection by default).
// Thin wrapper over utils/db-reload.ts's testable core (Phase 15): supplies
// the real connection/module-state dependencies, applies the outcome.
async function reloadDbAndRefreshDiagnostics(): Promise<void> {
	const outcome = await computeDbReload({
		getConfiguredDbPath: async () => {
			const config = await connection.workspace.getConfiguration("gram");
			return config?.ingredientDatabase?.path;
		},
		workspaceFolders,
		states,
		computeDiagnostics: provideDiagnostics,
		onWarn: (message) => connection.console.warn(message),
		onError: (message) => connection.console.error(message),
	});
	ingredientDB = outcome.ingredientDB;
	ingredientLookupSet = outcome.ingredientLookupSet;
	for (const [uri, diagnostics] of outcome.diagnosticsByUri) {
		connection.sendDiagnostics({ uri, diagnostics });
	}
}

connection.onInitialized(async () => {
	await reloadDbAndRefreshDiagnostics();

	// Watch ingredients.yaml so edits made outside the editor (gram db sync/enrich,
	// a hand-edit in another tool) refresh diagnostics without needing a restart —
	// previously the DB was only (re)loaded at init and on config changes (Phase 1.x).
	try {
		await connection.client.register(DidChangeWatchedFilesNotification.type, {
			watchers: [{ globPattern: "**/.gram/ingredients.yaml" }],
		});
	} catch {
		// Client doesn't support dynamic file watching — degrade silently,
		// the DB still (re)loads on init/config-change as before.
	}
	connection.onDidChangeWatchedFiles(() => {
		reloadDbAndRefreshDiagnostics().catch((e) =>
			connection.console.error(`DB reload failed: ${e}`),
		);
	});

	connection.onDidChangeConfiguration(() => {
		reloadDbAndRefreshDiagnostics().catch((e) =>
			connection.console.error(`DB reload failed: ${e}`),
		);
	});
});

function refresh(uri: string, text: string, version?: number) {
	const state = parseDocument(text, ingredientDB, version);
	states.set(uri, state);
	connection.sendDiagnostics({
		uri,
		diagnostics: provideDiagnostics(state, ingredientLookupSet, ingredientDB),
	});

	if (state.compilation) {
		try {
			const html = toHTML(state.compilation, {});
			connection.sendNotification("gram/previewUpdated", { uri, html });
		} catch (e) {
			console.error("HTML render error", e);
		}
	} else if (state.parseError) {
		// Fallback for syntax errors. ohm-js error messages often embed a snippet of
		// the offending source line for context, so this must be escaped like any
		// other user-controlled content reaching the preview webview (audit Chantier 6).
		const html = `
            <div style="padding: 20px; color: var(--vscode-errorForeground);">
                <h2>Syntax Error</h2>
                <pre style="background: var(--vscode-editorWidget-background); padding: 10px; border-radius: 6px;">${escapeHtml(state.parseError)}</pre>
            </div>
        `;
		connection.sendNotification("gram/previewUpdated", { uri, html });
	}
}

// Debounced so a full parse + compile + HTML render doesn't run synchronously
// on every keystroke — same pattern already used in cli/src/commands/watch.ts.
const pendingRefresh = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRefresh(uri: string, text: string, version: number): void {
	const existing = pendingRefresh.get(uri);
	if (existing) clearTimeout(existing);
	pendingRefresh.set(
		uri,
		setTimeout(() => {
			pendingRefresh.delete(uri);
			refresh(uri, text, version);
		}, 150),
	);
}

// See utils/fresh-state.ts (audit 2026-07-22, finding B5) — formatting,
// rename, and code actions call this instead of reading `states` directly,
// so they always operate on the live text.
function getFreshState(uri: string): DocumentState | undefined {
	const doc = documents.get(uri);
	if (!doc) return states.get(uri);
	const fresh = resolveFreshState(
		states.get(uri),
		doc.getText(),
		doc.version,
		ingredientDB,
	);
	states.set(uri, fresh);
	return fresh;
}

documents.onDidOpen((e) =>
	refresh(e.document.uri, e.document.getText(), e.document.version),
);
documents.onDidChangeContent((e) =>
	scheduleRefresh(e.document.uri, e.document.getText(), e.document.version),
);
documents.onDidClose((e) => {
	states.delete(e.document.uri);
	const pending = pendingRefresh.get(e.document.uri);
	if (pending) {
		clearTimeout(pending);
		pendingRefresh.delete(e.document.uri);
	}
	connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

connection.onDocumentSymbol(({ textDocument: { uri } }) => {
	const s = states.get(uri);
	return s ? provideDocumentSymbols(s) : [];
});

connection.onDefinition(({ textDocument: { uri }, position }) => {
	const s = states.get(uri);
	if (!s) return null;
	const loc = provideDefinition(s, position);
	if (!loc) return null;
	return { ...loc, uri };
});

connection.onHover(({ textDocument: { uri }, position }) => {
	const s = states.get(uri);
	return s ? provideHover(s, position, ingredientDB) : null;
});

connection.onFoldingRanges(({ textDocument: { uri } }) => {
	const s = states.get(uri);
	return s ? provideFoldingRanges(s) : [];
});

connection.onCompletion(({ textDocument: { uri }, position }) => {
	const s = states.get(uri);
	if (!s) return [];
	// Read the prefix from the live document, not the (possibly debounced)
	// state — see the doc comment on provideCompletions (Phase 1.2).
	const doc = documents.get(uri);
	const prefix = doc
		? doc.getText({
				start: { line: position.line, character: 0 },
				end: position,
			})
		: s.text.slice(
				s.lineStarts[position.line] ?? 0,
				positionToOffset(s.lineStarts, position),
			);
	return provideCompletions(s, ingredientDB, prefix);
});

connection.onReferences(({ textDocument: { uri }, position }) => {
	const s = states.get(uri);
	if (!s) return [];
	return provideReferences(s, position).map((loc) => ({ ...loc, uri }));
});

connection.onPrepareRename(({ textDocument: { uri }, position }) => {
	const s = getFreshState(uri);
	return s ? prepareName(s, position) : null;
});

connection.onRenameRequest(({ textDocument: { uri }, position, newName }) => {
	const s = getFreshState(uri);
	return s ? provideRename(s, position, newName, uri) : null;
});

connection.onDocumentFormatting(({ textDocument: { uri } }) => {
	const s = getFreshState(uri);
	return s ? provideFormatting(s) : [];
});

connection.onCodeAction(({ textDocument: { uri }, range, context }) => {
	const s = getFreshState(uri);
	return s
		? provideCodeActions(s, range, context.diagnostics, uri, ingredientDB)
		: [];
});

connection.languages.semanticTokens.on(({ textDocument: { uri } }) => {
	const s = states.get(uri);
	return s ? provideSemanticTokens(s) : { data: [] };
});

connection.languages.inlayHint.on(({ textDocument: { uri } }) => {
	const s = states.get(uri);
	return s ? provideInlayHints(s) : [];
});

connection.onCodeLens(({ textDocument: { uri } }) => {
	const s = states.get(uri);
	return s ? provideCodeLenses(s) : [];
});

documents.listen(connection);
connection.listen();
