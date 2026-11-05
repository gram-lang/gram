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
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadModuleGraph, type ModuleGraph } from "@gram-lang/modules";
import type { AnalyzedCompilationResult } from "@gram-lang/analyzer";
import { ALL_DAY, type Availability } from "@gram-lang/scheduler";
import { parseDocument, type DocumentState } from "./document-state";
import { createLspModuleHost } from "./module-host";
import { findProjectRootSync } from "./utils/project-root";
import {
	readPathsConfigSync,
	readAvailabilityConfigSync,
	readMealTimesConfigSync,
	readTimeZoneConfigSync,
} from "./utils/module-paths-config";
import { affectedOpenImporters } from "./utils/module-invalidation";
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
import {
	DEFAULT_RECIPE_SETTINGS,
	DEFAULT_VIEW_SETTINGS,
	type KitchenContext,
	type RecipeSettings,
	type ViewSettings,
	escapeHtml,
	parseRecipeSettings,
	parseViewSettings,
	toGanttHTML,
	toHTML,
	viewSettingsToRendererOptions,
} from "@gram-lang/renderer";
import {
	compileSessionChanged,
	compileSessionOf,
	parseSession,
	type Session,
} from "./session";
import { describeOutputs, renderOutputs, serveTimesOf } from "./views";

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

// The module-imports RFC (§F.1) module resolution state — a `ModuleGraph`
// per open document, and one yield-measurement cache shared across all of
// them (mirrors the CLI's `opts.moduleCache`, `core/pipeline.ts:59`, so a
// base imported by several open files isn't re-measured on every keystroke
// of every importer). `graphs` is only refreshed by the async `refresh()`
// pipeline below; the synchronous `getFreshState` path (formatting, rename,
// code actions) intentionally does not reload it — see the module-imports
// RFC's note on why `loadModuleGraph`/`composeRecipe` are split into an
// async load stage and a synchronous consume stage.
const graphs = new Map<string, ModuleGraph>();
const moduleMeasureCache = new Map<string, AnalyzedCompilationResult>();

// `findProjectRootSync`/`readPathsConfigSync` are both blocking (`existsSync`
// walks up the directory tree, `readPathsConfigSync` does a sync file read +
// YAML parse) — cheap once, but `loadGraphFor` used to redo them on every
// 150ms-debounced edit of every open document, stalling the event loop on
// every keystroke even for documents with no `@use` at all. Keyed by
// directory (not by document) so every open file under the same project
// shares one lookup. Cleared wholesale on a `.gram/config.yaml` change
// (`onDidChangeWatchedFiles` below) — the one thing that can make a cached
// entry wrong — so a `paths:` edit still takes effect on that document's
// next refresh, same as before this cache existed.
const projectContextCache = new Map<
	string,
	{
		projectRoot: string;
		paths?: Record<string, string>;
		timeZone?: string;
		availability?: Availability;
		mealTimes?: string[];
	}
>();

/** The project context of the directory of `uri`, read once per directory. */
function projectContextOf(uri: string) {
	const dir = dirname(fileURLToPath(uri));
	let ctx = projectContextCache.get(dir);
	if (!ctx) {
		const projectRoot = findProjectRootSync(dir);
		ctx = {
			projectRoot,
			paths: readPathsConfigSync(projectRoot),
			timeZone: readTimeZoneConfigSync(projectRoot),
			availability: readAvailabilityConfigSync(projectRoot),
			mealTimes: readMealTimesConfigSync(projectRoot),
		};
		projectContextCache.set(dir, ctx);
	}
	return ctx;
}

/**
 * The kitchen a serving time of `uri` is laid out in: the `timezone` of the
 * project's `.gram/config.yaml`, else this machine's; its `availability`,
 * else all day; now.
 */
function kitchenOf(uri: string): KitchenContext {
	let timeZone: string | undefined;
	let availability: Availability | undefined;
	if (uri.startsWith("file:")) {
		try {
			({ timeZone, availability } = projectContextOf(uri));
		} catch {
			// An unreadable project: the machine's zone, all day.
		}
	}
	return {
		timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
		availability: availability ?? { daily: [...ALL_DAY.daily] },
		now: new Date().toISOString(),
	};
}

/**
 * Loads (or reloads) `uri`'s `@use` graph — never throws, and returns
 * `undefined` for anything that isn't a `file:` document (an untitled or
 * virtual-workspace buffer, same guard as `resolveWorkspaceFolders`) or
 * whose graph fails to load for a reason unrelated to the module system
 * itself. A file with no `@use` at all still goes through this — cheap,
 * since `loadModuleGraph` then does the one read `parseDocument` needed
 * anyway — so there is exactly one code path rather than a
 * has-imports branch to keep in sync (same rationale as the CLI's
 * `runPipeline`, `core/pipeline.ts:24`).
 */
async function loadGraphFor(uri: string): Promise<ModuleGraph | undefined> {
	if (!uri.startsWith("file:")) return undefined;
	try {
		const ctx = projectContextOf(uri);
		const host = createLspModuleHost(ctx.projectRoot, documents, ctx.paths);
		return await loadModuleGraph(uri, host);
	} catch (e) {
		connection.console.error(`Module graph load failed for ${uri}: ${e}`);
		return undefined;
	}
}

// The views protocol (`gram/viewUpdated`, `gram/setOpenViews`,
// `gram/setSession`). A client that declares it (`initializationOptions.views`)
// or sends `gram/setOpenViews` gets only the outputs it has open. Any other
// client is an older one: it keeps receiving the preview and the work plan of
// every document through the notifications it reads.
let viewsClient = false;
// The editor's language, for the words the server writes itself (the paused
// banner): the recipe's own language is unknown when it does not parse.
let locale: string | undefined;

connection.onInitialize((params: InitializeParams): InitializeResult => {
	workspaceFolders = resolveWorkspaceFolders(params.workspaceFolders);
	locale = params.locale;
	const init = params.initializationOptions as { views?: unknown } | undefined;
	if (init?.views === true) viewsClient = true;
	return {
		capabilities: {
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
			codeLensProvider: { resolveProvider: false },
			// What a client of the views protocol can open, named in the
			// editor's language: it builds its choice of views from this, so
			// a view added to the renderer appears there with no edit.
			experimental: { gramViews: describeOutputs(locale) },
		},
	};
});

// The view settings (`gram.miseEnPlace`, `gram.rests`, `gram.comments`, ...):
// what the preview, the work plan and the title hint follow. The recipe
// settings (`gram.bakersMath`, `gram.massStandardization`, ...): what the
// analyzer computes. Read once at start and again whenever the settings
// change; a missing or unknown one is on its default, so a bad setting never
// blanks a view.
let settings: ViewSettings = DEFAULT_VIEW_SETTINGS;
let recipeSettings: RecipeSettings = DEFAULT_RECIPE_SETTINGS;

function differs<T extends object>(a: T, b: T): boolean {
	return (Object.keys(a) as (keyof T)[]).some((key) => a[key] !== b[key]);
}

// Never rejects (same rule as reloadDbAndRefreshDiagnostics below): a client
// without workspace configuration just keeps the defaults.
async function loadSettings(): Promise<{ view: boolean; recipe: boolean }> {
	try {
		const config = await connection.workspace.getConfiguration("gram");
		const nextView = parseViewSettings(config);
		const nextRecipe = parseRecipeSettings(config);
		const changed = {
			view: differs(nextView, settings),
			recipe: differs(nextRecipe, recipeSettings),
		};
		settings = nextView;
		recipeSettings = nextRecipe;
		return changed;
	} catch {
		return { view: false, recipe: false };
	}
}

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

// New view settings re-render every open preview and work plan from the
// compilation already in hand, and refresh the title hint: nothing is parsed or
// compiled again. New recipe settings change what the analyzer computed, so
// every open document is analyzed again, through the same debounced refresh as
// an edit (which renders its views too), never racing with one.
async function reloadSettingsAndRefresh(): Promise<void> {
	const changed = await loadSettings();
	if (changed.recipe) {
		for (const doc of documents.all()) {
			scheduleRefresh(doc.uri, doc.getText(), doc.version);
		}
	} else if (changed.view) {
		for (const uri of states.keys()) renderViews(uri);
	} else {
		return;
	}
	await connection.languages.inlayHint.refresh().catch(() => {
		// Client without inlay hint refresh: the hint updates on next edit.
	});
}

// Registered here, not inside `onInitialized`: that callback awaits the first
// settings and the database before it gets to the end, and a settings change
// sent in the meantime (VS Code does send one right after starting) would
// reach a connection with no handler and be dropped, leaving every open recipe
// on the old setting until the next change.
connection.onDidChangeConfiguration(() => {
	reloadDbAndRefreshDiagnostics().catch((e) =>
		connection.console.error(`DB reload failed: ${e}`),
	);
	reloadSettingsAndRefresh().catch((e) =>
		connection.console.error(`Settings refresh failed: ${e}`),
	);
});

connection.onInitialized(async () => {
	// A document may already be open by the time the setting answers: without
	// the refresh it would keep the default settings until its next edit.
	await reloadSettingsAndRefresh().catch((e) =>
		connection.console.error(`Settings refresh failed: ${e}`),
	);
	await reloadDbAndRefreshDiagnostics();

	// Watch ingredients.yaml so edits made outside the editor (gram db sync/enrich,
	// a hand-edit in another tool) refresh diagnostics without needing a restart —
	// previously the DB was only (re)loaded at init and on config changes (Phase 1.x).
	// Also watch every `.gram` file (module-imports RFC §F.1) so an on-disk
	// change to a dependency that isn't itself open — an external `git pull`,
	// another tool, a save from a *different* editor window — still reaches
	// any open importer, not just edits made through this document's own
	// buffer.
	try {
		await connection.client.register(DidChangeWatchedFilesNotification.type, {
			watchers: [
				{ globPattern: "**/.gram/ingredients.yaml" },
				{ globPattern: "**/.gram/config.yaml" },
				{ globPattern: "**/*.gram" },
			],
		});
	} catch {
		// Client doesn't support dynamic file watching — degrade silently,
		// the DB still (re)loads on init/config-change as before, and an open
		// document still resyncs to an on-disk dependency change the next
		// time it's itself edited.
	}
	connection.onDidChangeWatchedFiles((params) => {
		let dbChanged = false;
		for (const change of params.changes) {
			if (change.uri.endsWith(".gram")) {
				invalidateDependents(change.uri);
			} else if (change.uri.endsWith(".gram/config.yaml")) {
				// A `paths:` alias edit invalidates every cached project
				// root/paths lookup (`loadGraphFor`'s `projectContextCache`) — the
				// next debounced refresh of each open document recomputes it fresh,
				// same as every refresh did before that cache existed.
				projectContextCache.clear();
			} else {
				dbChanged = true;
			}
		}
		if (dbChanged) {
			reloadDbAndRefreshDiagnostics().catch((e) =>
				connection.console.error(`DB reload failed: ${e}`),
			);
		}
	});
});

async function refresh(
	uri: string,
	text: string,
	version?: number,
): Promise<void> {
	const graph = await loadGraphFor(uri);
	if (graph) graphs.set(uri, graph);
	else graphs.delete(uri);

	const state = parseDocument(
		text,
		ingredientDB,
		version,
		graph ? { graph, cache: moduleMeasureCache } : undefined,
		recipeSettings,
	);
	states.set(uri, state);
	connection.sendDiagnostics({
		uri,
		diagnostics: provideDiagnostics(
			state,
			uri,
			ingredientLookupSet,
			ingredientDB,
		),
	});

	// The session's scale or stock change what is compiled: the views get a
	// compilation of their own, the rest of the editor keeps the source as
	// written.
	const sitting = compileSessionOf(sessions.get(uri) ?? {});
	if (sitting) {
		viewStates.set(
			uri,
			parseDocument(
				text,
				ingredientDB,
				version,
				graph ? { graph, cache: moduleMeasureCache } : undefined,
				recipeSettings,
				sitting,
			),
		);
	} else {
		viewStates.delete(uri);
	}

	renderViews(uri);
}

// What each document has open, as the client last said (`gram/setOpenViews`).
const openViews = new Map<string, Set<string>>();
// What the cook chose for each document this sitting (`gram/setSession`).
const sessions = new Map<string, Session>();
// The compilation of the views, when the session's scale or stock differ from
// the source as written; otherwise the views read `states`.
const viewStates = new Map<string, DocumentState>();

connection.onNotification(
	"gram/setOpenViews",
	(params: { uri?: unknown; viewIds?: unknown }) => {
		viewsClient = true;
		if (typeof params?.uri !== "string") return;
		const ids = Array.isArray(params.viewIds)
			? params.viewIds.filter((id): id is string => typeof id === "string")
			: [];
		if (ids.length === 0) openViews.delete(params.uri);
		else openViews.set(params.uri, new Set(ids));
		// A newly opened panel needs its content now, not at the next edit.
		if (states.has(params.uri)) renderViews(params.uri);
	},
);

connection.onNotification("gram/setSession", (params: unknown) => {
	const uri = (params as { uri?: unknown } | null)?.uri;
	if (typeof uri !== "string") return;
	const previous = sessions.get(uri) ?? {};
	const next = parseSession(params);
	if (Object.keys(next).length === 0) sessions.delete(uri);
	else sessions.set(uri, next);
	const doc = documents.get(uri);
	if (doc && compileSessionChanged(previous, next)) {
		scheduleRefresh(uri, doc.getText(), doc.version);
	} else if (states.has(uri)) {
		renderViews(uri);
	}
});

/** The `mealTimes` of the project of `uri`, when it sets them. */
function mealTimesOf(uri: string): string[] | undefined {
	if (!uri.startsWith("file:")) return undefined;
	try {
		return projectContextOf(uri).mealTimes;
	} catch {
		return undefined;
	}
}

connection.onRequest("gram/serveTimes", (params: unknown) => {
	const uri = (params as { uri?: unknown } | null)?.uri;
	if (typeof uri !== "string") return null;
	const state = viewStates.get(uri) ?? states.get(uri);
	if (!state) return null;
	try {
		return serveTimesOf(state, {
			settings,
			kitchen: kitchenOf(uri),
			locale,
			mealTimes: mealTimesOf(uri),
		});
	} catch (e) {
		connection.console.error(`serve times error: ${e}`);
		return null;
	}
});

/**
 * Sends the views of an already compiled document: the outputs the client has
 * open, or, to an older client, the preview and the work plan. Pure output of
 * the cached state: it neither parses nor compiles, so it can run again (a new
 * view setting, a panel opened) without touching it.
 */
function renderViews(uri: string): void {
	const state = viewStates.get(uri) ?? states.get(uri);
	if (!state) return;
	if (!viewsClient) {
		renderLegacyViews(uri, state);
		return;
	}
	const open = openViews.get(uri);
	if (!open) return;
	const updates = renderOutputs(uri, state, open, {
		settings,
		kitchen: kitchenOf(uri),
		serveAt: sessions.get(uri)?.serveAt,
		locale,
		onError: (outputId, e) =>
			connection.console.error(`${outputId} render error: ${e}`),
	});
	for (const update of updates) {
		connection.sendNotification("gram/viewUpdated", update);
	}
}

let warnedLegacyViews = false;

/**
 * The views of an older client, one that does not speak the views protocol:
 * the preview and the work plan of every document, and the Gantt chart, each
 * in its own notification, rendered on every refresh whether shown or not.
 * Deprecated with those notifications, removed in 2.0.0.
 */
// @remove-in: 2.0.0 [lsp-legacy-view-notifications]
function renderLegacyViews(uri: string, state: DocumentState): void {
	if (!warnedLegacyViews) {
		warnedLegacyViews = true;
		connection.console.warn(
			"gram/previewUpdated is deprecated and will be removed in 2.0.0: declare `initializationOptions.views` and read gram/viewUpdated instead.",
		);
	}
	if (state.compilation) {
		try {
			// The VS Code preview ships the renderer's stylesheet (mirrored in
			// media/preview.css), so the CSS-only nutrition basis toggle works
			// there — quantities stay read-only.
			const html = toHTML(state.compilation, {
				interactiveNutrition: true,
				...viewSettingsToRendererOptions(settings),
			});
			connection.sendNotification("gram/previewUpdated", { uri, html });
		} catch (e) {
			console.error("HTML render error", e);
		}

		// Still sent until 2.0.0 for clients that read it; the VS Code extension
		// no longer does.
		// @remove-in: 2.0.0 [lsp-gantt-notification]
		try {
			const ganttHtml = toGanttHTML(state.compilation, {
				miseEnPlace: settings.miseEnPlace,
				rests: settings.rests,
				// Rendered for clients that read it, not by choice of this server.
				quiet: true,
			});
			connection.sendNotification("gram/ganttUpdated", {
				uri,
				html: ganttHtml,
			});
		} catch (e) {
			console.error("Gantt render error", e);
		}
	} else if (state.parseError != null || state.compileError != null) {
		// Truthiness (`||`) would treat a thrown `Error()` with an empty
		// message the same as "no error" — silently skipping the webview
		// notification below and leaving preview/Gantt on stale content,
		// exactly the "silent compilation failure" this refresh path exists
		// to prevent.
		const isParse = state.parseError != null;
		const title = isParse ? "Syntax Error" : "Compilation Error";
		const errorMessage = state.parseError ?? state.compileError ?? "";
		const offsetAttr =
			state.parseErrorOffset !== null
				? ` data-offset="${state.parseErrorOffset}"`
				: "";
		const html = `
            <div class="gram-preview-error-state" style="padding: 24px 20px; font-family: var(--gram-font-sans, inherit); max-width: 600px; margin: 0 auto; text-align: center;">
                <div style="color: var(--vscode-errorForeground, #ef4444); margin-bottom: 12px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="currentColor" viewBox="0 0 256 256" style="display: inline-block;">
                        <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z"></path>
                    </svg>
                </div>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: var(--vscode-editor-foreground, inherit);">${title}</h3>
                <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--vscode-descriptionForeground, #888); line-height: 1.4;">Generation paused due to an error in the recipe.</p>
                <div style="text-align: left; background: var(--vscode-editorWidget-background, #1e1e1e); border: 1px solid var(--vscode-widget-border, #333); border-radius: 6px; padding: 12px; font-family: var(--gram-font-mono, monospace); font-size: 12px; color: var(--vscode-editor-foreground, #ccc); white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow-y: auto;">${escapeHtml(errorMessage)}</div>
                ${state.parseErrorOffset !== null ? `<button class="gram-goto-btn"${offsetAttr} style="margin-top: 14px; padding: 6px 14px; background: var(--vscode-button-background, #007acc); color: var(--vscode-button-foreground, #fff); border: none; border-radius: 4px; font-size: 12px; font-weight: 500; cursor: pointer;">Jump to error</button>` : ""}
            </div>
        `;
		connection.sendNotification("gram/previewUpdated", { uri, html });
		// @remove-in: 2.0.0 [lsp-gantt-notification]
		connection.sendNotification("gram/ganttUpdated", { uri, html });
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
			refresh(uri, text, version).catch((e) =>
				connection.console.error(`refresh failed for ${uri}: ${e}`),
			);
		}, 150),
	);
}

/**
 * Propagates a change in `changedUri` to every currently open document that
 * transitively `@use`s it (module-imports RFC §F.1) — the A -> B -> C case:
 * editing C, even unsaved, must refresh A's diagnostics through B. Also
 * invalidates `changedUri`'s own entry in the shared yield-measurement
 * cache, since that cached `AnalyzedCompilationResult` is now stale — left
 * unfixed, an importer would keep reusing C's *old* measured yield/scale
 * factor forever, having no other reason to ever recompute it.
 *
 * Called from three places: an open document's own content changing, the
 * `**\/*.gram` file-watcher (an on-disk change to a file that may not even
 * be open itself), and a document closing (its host's `read()` source
 * switches from the live buffer back to disk, which open importers must
 * pick up).
 */
function invalidateDependents(changedUri: string): void {
	moduleMeasureCache.delete(changedUri);
	const openUris = documents.all().map((d) => d.uri);
	for (const uri of affectedOpenImporters(graphs, openUris, changedUri)) {
		const doc = documents.get(uri);
		if (doc) scheduleRefresh(uri, doc.getText(), doc.version);
	}
}

// See utils/fresh-state.ts (audit 2026-07-22, finding B5) — formatting,
// rename, and code actions call this instead of reading `states` directly,
// so they always operate on the live text.
function getFreshState(uri: string): DocumentState | undefined {
	const doc = documents.get(uri);
	if (!doc) return states.get(uri);
	const graph = graphs.get(uri);
	const fresh = resolveFreshState(
		states.get(uri),
		doc.getText(),
		doc.version,
		ingredientDB,
		graph ? { graph, cache: moduleMeasureCache } : undefined,
		recipeSettings,
	);
	states.set(uri, fresh);
	return fresh;
}

documents.onDidOpen((e) => {
	refresh(e.document.uri, e.document.getText(), e.document.version).catch(
		(err) =>
			connection.console.error(`refresh failed for ${e.document.uri}: ${err}`),
	);
});
documents.onDidChangeContent((e) => {
	scheduleRefresh(e.document.uri, e.document.getText(), e.document.version);
	invalidateDependents(e.document.uri);
});
documents.onDidClose((e) => {
	states.delete(e.document.uri);
	viewStates.delete(e.document.uri);
	openViews.delete(e.document.uri);
	sessions.delete(e.document.uri);
	graphs.delete(e.document.uri);
	const pending = pendingRefresh.get(e.document.uri);
	if (pending) {
		clearTimeout(pending);
		pendingRefresh.delete(e.document.uri);
	}
	// The closing document's `read()` source switches from its live buffer
	// back to disk (module-host.ts) — any open importer must resync to that,
	// not keep reflecting whatever was last in the (now-gone) buffer.
	invalidateDependents(e.document.uri);
	connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

connection.onDocumentSymbol(({ textDocument: { uri } }) => {
	const s = states.get(uri);
	return s ? provideDocumentSymbols(s) : [];
});

connection.onDefinition(({ textDocument: { uri }, position }) => {
	const s = states.get(uri);
	if (!s) return null;
	// The returned Location's own uri now comes from provideDefinition
	// itself (module-imports RFC §F.1) — a cross-file jump into an `@use`d
	// base names *that* file's uri, not this one.
	return provideDefinition(s, uri, position);
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
	return provideCompletions(s, ingredientDB, prefix, uri);
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
	return s ? provideInlayHints(s, settings.miseEnPlace, settings.rests) : [];
});

connection.onCodeLens(({ textDocument: { uri } }) => {
	const s = states.get(uri);
	return s ? provideCodeLenses(s) : [];
});

documents.listen(connection);
connection.listen();
