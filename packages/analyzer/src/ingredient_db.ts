import type { IngredientData } from "./types";
import { slugify } from "@gram-lang/kitchen";

function buildAliasIndex(
	database: Record<string, IngredientData>,
): Map<string, string> {
	const index = new Map<string, string>();
	for (const [key, entry] of Object.entries(database)) {
		if (entry.name) index.set(entry.name.toLowerCase(), key);
		if (entry.aliases) {
			entry.aliases.forEach((a) => {
				index.set(a.toLowerCase(), key);
			});
		}
	}
	return index;
}

// Maps alias/name (lowercased) -> canonical database key. Lazily built and
// memoized on the database object itself, so repeated lookups don't rebuild it.
function getAliasIndex(
	database: Record<string, IngredientData>,
): Map<string, string> {
	if (!(database as any).__aliasIndex) {
		Object.defineProperty(database, "__aliasIndex", {
			value: buildAliasIndex(database),
			enumerable: false,
			writable: true,
		});
	}
	return (database as any).__aliasIndex as Map<string, string>;
}

export function getIngredientData(
	name: string,
	database: Record<string, IngredientData>,
): IngredientData | null {
	const slug = slugify(name);

	// Direct match
	const direct = database[slug];
	if (direct) return direct;

	const index = getAliasIndex(database);
	const key = index.get(name.toLowerCase()) || index.get(slug);
	return key !== undefined ? (database[key] ?? null) : null;
}

/**
 * Resolves an ingredient name/alias to its canonical database key (e.g. "beurre" -> "butter"),
 * so that shopping-list aggregation can group aliased ingredients under one entry.
 * Falls back to `slugify(name)` when the ingredient isn't found in the database.
 */
export function resolveCanonicalId(
	name: string,
	database: Record<string, IngredientData>,
): string {
	const slug = slugify(name);
	if (database[slug]) return slug;

	const index = getAliasIndex(database);
	return index.get(name.toLowerCase()) || index.get(slug) || slug;
}
