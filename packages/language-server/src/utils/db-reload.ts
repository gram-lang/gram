import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic } from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import {
	loadIngredientDB,
	buildIngredientLookupSet,
	type IngredientDB,
} from "../ingredient-loader";
import type { IngredientValidationIssue } from "@gram-lang/analyzer";

export interface ResolvedDb {
	db: IngredientDB;
	lookupSet: Set<string>;
	rejected: IngredientValidationIssue[];
}

/**
 * Pure resolution of which ingredient database to load, and its result.
 * Extracted from `server.ts`'s old `loadDB()` so it's unit-testable without a
 * real LSP connection or workspace — an explicit `configPath` wins, else the
 * first workspace folder with a `.gram/ingredients.yaml` is used, else the
 * database is empty.
 */
export function resolveIngredientDb(
	configPath: string | undefined,
	workspaceFolders: string[],
): ResolvedDb {
	let result:
		| { db: IngredientDB; rejected: IngredientValidationIssue[] }
		| undefined;
	if (configPath?.trim()) {
		result = loadIngredientDB(configPath.trim());
	} else {
		for (const folder of workspaceFolders) {
			const auto = join(folder, ".gram", "ingredients.yaml");
			if (existsSync(auto)) {
				result = loadIngredientDB(auto);
				break;
			}
		}
	}
	const db = result?.db ?? {};
	return {
		db,
		lookupSet: buildIngredientLookupSet(db),
		rejected: result?.rejected ?? [],
	};
}

export interface DbReloadDeps {
	/** May reject — the caller's config lookup can fail independently of the DB itself. */
	getConfiguredDbPath: () => Promise<string | undefined>;
	workspaceFolders: string[];
	states: ReadonlyMap<string, DocumentState>;
	computeDiagnostics: (
		state: DocumentState,
		ingredientLookupSet: Set<string>,
		ingredientDB: IngredientDB,
	) => Diagnostic[];
	onWarn: (message: string) => void;
	onError: (message: string) => void;
}

export interface DbReloadOutcome {
	ingredientDB: IngredientDB;
	ingredientLookupSet: Set<string>;
	diagnosticsByUri: Map<string, Diagnostic[]>;
}

/**
 * Audit 2026-07-22, LSP finding B3 (Phase 3 backlog item, completed Phase
 * 15): `server.ts`'s `reloadDbAndRefreshDiagnostics` used to close over
 * module-level state (`connection`, `states`, `ingredientDB`), making it
 * untestable in isolation — noted at the time as "a refactor plus large, non
 * fait ici". Every dependency is now passed in explicitly, so this can be
 * unit-tested with fakes instead of a real LSP connection. Must never
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
			resolved = { db: {}, lookupSet: new Set(), rejected: [] };
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
				deps.computeDiagnostics(state, resolved.lookupSet, resolved.db),
			);
		} catch (e) {
			deps.onError(`Failed to refresh diagnostics for ${uri}: ${e}`);
		}
	}

	return {
		ingredientDB: resolved.db,
		ingredientLookupSet: resolved.lookupSet,
		diagnosticsByUri,
	};
}
