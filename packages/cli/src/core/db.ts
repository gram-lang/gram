import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parse } from "yaml";
import { validateIngredientDatabase } from "@gram-lang/analyzer";
import type {
	IngredientData,
	IngredientValidationIssue,
} from "@gram-lang/analyzer";
import type { GramConfig } from "../types";
import { GramConfigError, ExitCode } from "../errors";

export function resolveDbPath(
	config: GramConfig,
	overridePath?: string,
): string {
	const root = config.projectRoot ?? process.cwd();
	if (overridePath) return resolve(overridePath);
	if (config.database) return resolve(root, config.database);
	return join(root, ".gram", "ingredients.yaml");
}

export interface LoadDbResult {
	data: Record<string, IngredientData> | null;
	rejected: IngredientValidationIssue[];
	dbPath: string;
}

/**
 * `core/` must never itself decide to write anything, not even to stderr —
 * the
 * previous targeted fix (writing rejected-entry warnings via
 * `process.stderr.write` right here) already fixed the *measured* bug
 * (`log.warn`/@clack/prompts corrupting `gram build | jq`'s stdout), but
 * still left `core/` making a display decision. `loadDb` now returns
 * `rejected` as a value; reporting it (or not) is entirely up to the
 * `commands/` layer, via `reportRejectedIngredients` (`ui/diagnostics.ts`).
 */
export async function loadDb(
	config: GramConfig,
	overridePath?: string,
): Promise<LoadDbResult> {
	const dbPath = resolveDbPath(config, overridePath);

	let raw: unknown;
	try {
		const content = await readFile(dbPath, "utf-8");
		raw = parse(content);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return { data: null, rejected: [], dbPath };
		}
		throw new GramConfigError(
			`Cannot read ingredient database at ${dbPath}: ${(err as Error).message}`,
		);
	}

	// Empty file (comments-only YAML parses to null) = no database
	if (raw == null) return { data: null, rejected: [], dbPath };

	// Support both formats: with or without top-level 'ingredients:' wrapper.
	// If the wrapper key exists but is null/empty (e.g. `ingredients:` with no entries),
	// treat as an empty database rather than an error.
	const rawObj = raw as Record<string, unknown>;
	const hasWrapper = typeof rawObj === "object" && "ingredients" in rawObj;
	const ingredients = hasWrapper ? (rawObj.ingredients ?? {}) : raw;

	const { data, rejected } = validateIngredientDatabase(ingredients);
	return { data, rejected, dbPath };
}

export async function loadDbSafe(
	config: GramConfig,
	overridePath?: string,
): Promise<LoadDbResult> {
	try {
		return await loadDb(config, overridePath);
	} catch (err) {
		if (err instanceof GramConfigError) {
			process.stderr.write(`${err.message}\n`);
			process.exit(err.exitCode ?? ExitCode.InternalError);
		}
		throw err;
	}
}
