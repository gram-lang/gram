import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parse } from "yaml";
import { validateIngredientDatabase } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
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

export async function loadDb(
	config: GramConfig,
	overridePath?: string,
): Promise<Record<string, IngredientData> | null> {
	const dbPath = resolveDbPath(config, overridePath);

	let raw: unknown;
	try {
		const content = await readFile(dbPath, "utf-8");
		raw = parse(content);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw new GramConfigError(
			`Cannot read ingredient database at ${dbPath}: ${(err as Error).message}`,
		);
	}

	// Empty file (comments-only YAML parses to null) = no database
	if (raw == null) return null;

	// Support both formats: with or without top-level 'ingredients:' wrapper.
	// If the wrapper key exists but is null/empty (e.g. `ingredients:` with no entries),
	// treat as an empty database rather than an error.
	const rawObj = raw as Record<string, unknown>;
	const hasWrapper = typeof rawObj === "object" && "ingredients" in rawObj;
	const ingredients = hasWrapper ? (rawObj.ingredients ?? {}) : raw;

	const { data, rejected } = validateIngredientDatabase(ingredients);
	if (rejected.length > 0) {
		// Audit 2026-07-22, cli finding B-3: `core/` must never write to stdout —
		// `log.warn` (@clack/prompts) does, which corrupted machine-readable
		// output (`gram build | jq` and friends) the moment a database entry
		// failed validation. Diagnostics from this layer always go to stderr;
		// deciding whether/how to *display* them (spinner, color, etc.) is a
		// `commands/`-layer concern, not `core/`'s.
		process.stderr.write(
			`Ignoring ${rejected.length} invalid ingredient(s) in ${dbPath}: ${rejected.map((r) => r.key).join(", ")}\n`,
		);
	}
	return data;
}

export async function loadDbSafe(
	config: GramConfig,
	overridePath?: string,
): Promise<Record<string, IngredientData> | null> {
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
