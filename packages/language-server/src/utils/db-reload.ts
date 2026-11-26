import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic } from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { loadIngredientDB, type IngredientDB } from "../ingredient-loader";
import type { IngredientValidationIssue } from "@gram-lang/analyzer";
import { readProjectConfigSync } from "./project-config";

export interface ResolvedDb {
	db: IngredientDB;
	rejected: IngredientValidationIssue[];
	/** The file the database was read from; absent when there is none. */
	path?: string;
}

/**
 * The database file of a workspace folder, as `gram` finds it from that
 * folder (the CLI's `resolveDbPath`): the `database:` of its
 * `.gram/config.yaml`, relative to the folder, else its
 * `.gram/ingredients.yaml`. A `database:` naming a missing file is not
 * replaced by `.gram/ingredients.yaml`, as the CLI does not replace it.
 */
function folderDbPath(folder: string): string {
	const { database } = readProjectConfigSync(folder);
	return database
		? resolve(folder, database)
		: join(folder, ".gram", "ingredients.yaml");
}

/**
 * Pure resolution of which ingredient database to load, and its result.
 * Extracted from `server.ts`'s old `loadDB()` so it's unit-testable without a
 * real LSP connection or workspace — an explicit `configPath` (the editor's
 * `gram.ingredientDatabase.path`) wins, else the database of the first
 * workspace folder that has one (`folderDbPath`), else the database is empty.
 */
export function resolveIngredientDb(
	configPath: string | undefined,
	workspaceFolders: string[],
): ResolvedDb {
	let path: string | undefined;
	if (configPath?.trim()) {
		path = configPath.trim();
	} else {
		path = workspaceFolders.map(folderDbPath).find((p) => existsSync(p));
	}
	if (path === undefined || !existsSync(path)) return { db: {}, rejected: [] };
	const result = loadIngredientDB(path);
	return { db: result.db, rejected: result.rejected, path };
}

/**
 * Whether a watched file that changed is an ingredient database: any
 * `.gram/ingredients.yaml`, or the file the database in use was read from
 * (a `database:` of `.gram/config.yaml`, or the editor's setting), whatever
 * its name.
 */
export function isIngredientDbChange(
	uri: string,
	loadedPath: string | undefined,
): boolean {
	if (uri.endsWith("/.gram/ingredients.yaml")) return true;
	if (loadedPath === undefined || !uri.startsWith("file:")) return false;
	try {
		return resolve(fileURLToPath(uri)) === resolve(loadedPath);
	} catch {
		return false;
	}
}

export interface DbReloadDeps {
	/** May reject — the caller's config lookup can fail independently of the DB itself. */
	getConfiguredDbPath: () => Promise<string | undefined>;
	workspaceFolders: string[];
	states: ReadonlyMap<string, DocumentState>;
	computeDiagnostics: (
		state: DocumentState,
		uri: string,
		ingredientDB: IngredientDB,
	) => Diagnostic[];
	onWarn: (message: string) => void;
	onError: (message: string) => void;
}

export interface DbReloadOutcome {
	ingredientDB: IngredientDB;
	/** The file `ingredientDB` was read from; absent when there is none. */
	ingredientDbPath?: string;
	diagnosticsByUri: Map<string, Diagnostic[]>;
}

/**
 * `server.ts`'s `reloadDbAndRefreshDiagnostics` used to close over
 * module-level state (`connection`, `states`, `ingredientDB`), making it
 * untestable in isolation. Every dependency is now passed in explicitly, so
 * this can be unit-tested with fakes instead of a real LSP connection. Must never
 * reject — every real call site in `server.ts` treats it as fire-and-forget
 * (`onDidChangeWatchedFiles`/`onDidChangeConfiguration`), and an unhandled
 * rejection would otherwise crash the whole Node process.
 */
export async function reloadDbAndRefreshDiagnostics(
	deps: DbReloadDeps,
): Promise<DbReloadOutcome> {
	let resolved: ResolvedDb;
	try {
		const configPath = await deps.getConfiguredDbPath();
		resolved = resolveIngredientDb(configPath, deps.workspaceFolders);
	} catch {
		try {
			resolved = resolveIngredientDb(undefined, deps.workspaceFolders);
		} catch (e) {
			deps.onError(`Failed to load ingredient database: ${e}`);
			resolved = { db: {}, rejected: [] };
		}
	}

	if (resolved.rejected.length > 0) {
		deps.onWarn(
			`Ignoring ${resolved.rejected.length} invalid ingredient(s): ${resolved.rejected
				.map((r) => r.key)
				.join(", ")}`,
		);
	}

	const diagnosticsByUri = new Map<string, Diagnostic[]>();
	for (const [uri, state] of deps.states) {
		try {
			diagnosticsByUri.set(
				uri,
				deps.computeDiagnostics(state, uri, resolved.db),
			);
		} catch (e) {
			deps.onError(`Failed to refresh diagnostics for ${uri}: ${e}`);
		}
	}

	return {
		ingredientDB: resolved.db,
		...(resolved.path !== undefined ? { ingredientDbPath: resolved.path } : {}),
		diagnosticsByUri,
	};
}
