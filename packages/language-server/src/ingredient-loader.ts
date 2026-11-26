import { parse } from "yaml";
import { readFileSync, existsSync } from "node:fs";

import {
	validateIngredientDatabase,
	type IngredientData,
	type IngredientValidationIssue,
} from "@gram-lang/analyzer";

export type IngredientEntry = IngredientData;

export type IngredientDB = Record<string, IngredientEntry>;

export interface LoadIngredientDBResult {
	db: IngredientDB;
	rejected: IngredientValidationIssue[];
}

// This used to cast the parsed YAML straight to IngredientDB with no
// validation, so an entry missing `name` (or any other
// malformed entry) crashed the server the moment a lookup touched it — the
// CLI's `loadDb` (core/db.ts) already goes through validateIngredientDatabase
// for exactly this reason. A malformed entry is now dropped and reported
// instead of taking the whole server down with it.
export function loadIngredientDB(yamlPath: string): LoadIngredientDBResult {
	if (!existsSync(yamlPath)) return { db: {}, rejected: [] };
	try {
		const content = readFileSync(yamlPath, "utf-8");
		const parsed = parse(content) as { ingredients?: unknown } | undefined;
		const raw = parsed?.ingredients ?? parsed ?? {};
		const { data, rejected } = validateIngredientDatabase(raw);
		return { db: data, rejected };
	} catch {
		return { db: {}, rejected: [] };
	}
}

// Whether an ingredient is known is never decided here: the editor asks the
// analyzer (`isKnownIngredient`, and `findClosestIngredients` for the
// spelling suggestion), the same resolution nutrition and
// `analyzed.missingIngredients` use, so an ingredient the editor accepts is
// one the nutrition finds. This file used to keep its own lookup (raw keys,
// lowercased names, a French plural guess) and the two disagreed both ways:
// `@carottes` passed the editor while nutrition skipped it, `@olive-oil`
// was flagged while nutrition found it.

export function allIngredientCompletionLabels(
	db: IngredientDB,
): Array<{ label: string; canonical: string; entry: IngredientEntry }> {
	const results: Array<{
		label: string;
		canonical: string;
		entry: IngredientEntry;
	}> = [];
	for (const entry of Object.values(db)) {
		results.push({ label: entry.name, canonical: entry.name, entry });
		for (const alias of entry.aliases ?? []) {
			results.push({ label: alias, canonical: entry.name, entry });
		}
	}
	return results.sort((a, b) => a.label.localeCompare(b.label));
}
