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

// Audit 2026-07-22, finding B1: this used to cast the parsed YAML straight to
// IngredientDB with no validation, so an entry missing `name` (or any other
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

export function lookupIngredient(
	name: string,
	db: IngredientDB,
): IngredientEntry | null {
	if (Object.keys(db).length === 0) return null;
	const slug = slugify(name);

	// Direct match by slug key
	const bySlug = db[slug];
	if (bySlug) return bySlug;

	// Naive singularization
	if (slug.endsWith("s")) {
		const singular = db[slug.slice(0, -1)];
		if (singular) return singular;
	}

	// Search by name or aliases (case-insensitive)
	const nameLower = name.toLowerCase();
	for (const entry of Object.values(db)) {
		if (entry.name.toLowerCase() === nameLower) return entry;
		if (entry.aliases?.some((a) => a.toLowerCase() === nameLower)) return entry;
	}

	return null;
}

// Pre-computes all known lookup keys into a Set for O(1) ingredient existence checks.
// Must be rebuilt whenever the DB is reloaded.
export function buildIngredientLookupSet(db: IngredientDB): Set<string> {
	const set = new Set<string>();
	for (const [key, entry] of Object.entries(db)) {
		set.add(key); // slug key
		set.add(entry.name.toLowerCase()); // canonical name
		for (const alias of entry.aliases ?? []) {
			set.add(alias.toLowerCase()); // aliases
		}
	}
	return set;
}

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

// O(1) check — mirrors the lookup order of lookupIngredient() without linear scan.
// Handles common French plurals without fuzzy matching: each word's trailing 's' is
// tried as a singular form, so @carottes and @tomates cerises silently resolve.
export function isKnownIngredient(
	name: string,
	lookupSet: Set<string>,
): boolean {
	const slug = slugify(name);
	if (lookupSet.has(slug)) return true;
	if (lookupSet.has(name.toLowerCase())) return true;

	// Single-word plural: "carottes" → "carotte"
	if (slug.endsWith("s") && lookupSet.has(slug.slice(0, -1))) return true;

	// Multi-word: remove trailing 's' from each word ("tomates cerises" → "tomate cerise")
	const words = name.trim().split(/\s+/);
	if (words.length > 1) {
		const singular = words
			.map((w) => (w.endsWith("s") ? w.slice(0, -1) : w))
			.join(" ");
		if (singular !== name) {
			if (lookupSet.has(slugify(singular))) return true;
			if (lookupSet.has(singular.toLowerCase())) return true;
		}
	}

	return false;
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
		const candidates = [key, ...(entry.aliases ?? []).map((a) => slugify(a))];
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
