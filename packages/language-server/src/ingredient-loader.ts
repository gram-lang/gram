import { parse } from "yaml";
import { readFileSync, existsSync } from "node:fs";
import { slugify } from "@gram-lang/kitchen";

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
// analyzer (`getIngredientData`), the same resolution nutrition and
// `analyzed.missingIngredients` use, so an ingredient the editor accepts is
// one the nutrition finds. This file used to keep its own lookup (raw keys,
// lowercased names, a French plural guess) and the two disagreed both ways:
// `@carottes` passed the editor while nutrition skipped it, `@olive-oil`
// was flagged while nutrition found it.

// Levenshtein edit distance — used only for unknown-ingredient suggestions, never for hot-path lookups.
function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let prev = i;
		for (let j = 1; j <= b.length; j++) {
			const curr =
				a[i - 1] === b[j - 1]
					? row[j - 1]!
					: 1 + Math.min(row[j - 1]!, row[j]!, prev);
			row[j - 1] = prev;
			prev = curr;
		}
		row[b.length] = prev;
	}
	return row[b.length]!;
}

// Returns the canonical entry name whose slug is closest to the input (within maxDistance),
// or null if nothing is close enough. Only called for genuinely unknown ingredients.
export function findClosestIngredient(
	name: string,
	db: IngredientDB,
	maxDistance = 2,
): string | null {
	const inputSlug = slugify(name);
	let best: string | null = null;
	let bestDist = maxDistance + 1;
	for (const [key, entry] of Object.entries(db)) {
		const candidates = [key, entry.name, ...(entry.aliases ?? [])].map((c) =>
			slugify(c),
		);
		for (const candidate of candidates) {
			const d = levenshtein(inputSlug, candidate);
			if (d > 0 && d < bestDist) {
				bestDist = d;
				best = entry.name;
			}
		}
	}
	return best;
}

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
