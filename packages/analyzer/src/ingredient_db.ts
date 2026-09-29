import type { IngredientData } from "./types";
import { slugify } from "@gram-lang/kitchen";

type Database = Record<string, IngredientData>;

/**
 * Maps `slugify(key | name | alias)` -> canonical database key, the same
 * normalization the compiler uses for ingredient ids. That is what makes a
 * recipe's `@Huile d'olive` (id `huile-d-olive`) find a hand-written database
 * entry keyed `huile-dolive`. On collision a real key beats a name, which
 * beats an alias, so an alias can never shadow another entry's own key.
 */
export function buildIngredientIndex(database: Database): Map<string, string> {
	const index = new Map<string, string>();
	const claim = (label: string, key: string) => {
		const slug = slugify(label);
		if (!index.has(slug)) index.set(slug, key);
	};
	const entries = Object.entries(database);
	for (const [key] of entries) claim(key, key);
	for (const [key, entry] of entries) {
		if (entry.name) claim(entry.name, key);
	}
	for (const [key, entry] of entries) {
		for (const alias of entry.aliases ?? []) claim(alias, key);
	}
	return index;
}

// Memoized per database object, so repeated lookups don't rebuild the index.
const indexCache = new WeakMap<object, Map<string, string>>();

function getIngredientIndex(database: Database): Map<string, string> {
	let index = indexCache.get(database);
	if (!index) {
		index = buildIngredientIndex(database);
		indexCache.set(database, index);
	}
	return index;
}

/**
 * Resolves a recipe name or compiler id to its database key. `slugify` is
 * idempotent, so `"Huile d'olive"` and `"huile-d-olive"` resolve identically.
 */
function resolveKey(nameOrId: string, database: Database): string | undefined {
	const slug = slugify(nameOrId);
	if (Object.hasOwn(database, slug)) return slug;
	return getIngredientIndex(database).get(slug);
}

export function getIngredientData(
	name: string,
	database: Database,
): IngredientData | null {
	const key = resolveKey(name, database);
	return key !== undefined ? (database[key] ?? null) : null;
}

/**
 * Resolves an ingredient name/alias to its canonical database key (e.g. "beurre" -> "butter"),
 * so that shopping-list aggregation can group aliased ingredients under one entry.
 * Falls back to `slugify(name)` when the ingredient isn't found in the database.
 */
export function resolveCanonicalId(name: string, database: Database): string {
	return resolveKey(name, database) ?? slugify(name);
}
