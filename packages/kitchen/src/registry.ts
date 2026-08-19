import type { Registry, RegistryEntry } from "./types";
import type { Warning } from "./warnings";
import { slugify } from "./utils";

// Strip punctuation that bleeds into bare element names (e.g. #saucepan, or @salt.)
export const cleanRegistryName = (name: string) =>
	name.trim().replace(/[,;!?.]+$/, "");

/**
 * Three-way classification for a `&reference` usage, shared by shopping-list
 * generation and mass/nutrition aggregation: a true in-file intermediate
 * (`is_intermediate`) and an undefined reference (no registry entry at
 * all — already gets its own UNDEFINED_REFERENCE diagnostic elsewhere) both
 * have nothing purchasable to report and are excluded; a stocked import's
 * synthetic leaf has a real registry entry and is never `is_intermediate`,
 * so it falls through as counted. A non-reference item (a plain
 * `@ingredient`) is always counted — this check only ever excludes `&name`
 * usages. Takes the already-looked-up `entry` rather than the registry
 * itself so it works the same whether the caller holds a `RecipeRegistry`'s
 * live `Map` (kitchen) or a compiled `CompilationResult`'s plain-object
 * `registry.ingredients` (analyzer).
 */
export function isPurchasableReference(
	itemType: string | undefined,
	entry: RegistryEntry | undefined,
): boolean {
	if (itemType !== "reference") return true;
	return !!entry && !entry.is_intermediate;
}

export class RecipeRegistry implements Registry {
	ingredients = new Map<string, RegistryEntry>();
	cookware = new Map<string, { id: string; name: string }>();
	warnings: Warning[] = [];

	constructor(initialWarnings: Warning[] = []) {
		this.warnings = initialWarnings;
	}

	registerIngredient(
		name: string,
		data?: Partial<Omit<RegistryEntry, "id" | "name">> & {
			displayName?: string;
		},
	): string {
		const cleanedName = cleanRegistryName(name);
		const id = slugify(cleanedName);
		const existing = this.ingredients.get(id);
		if (!existing) {
			const { displayName, ...rest } = data ?? {};
			this.ingredients.set(id, {
				id,
				name: displayName ?? cleanedName,
				...rest,
			} as RegistryEntry);
		} else if (data) {
			if (data.default_unit && !existing.default_unit) {
				existing.default_unit = data.default_unit;
			}
			if (data.is_composite) existing.is_composite = true;
			if (data.parent) existing.parent = data.parent;
			if (data.is_intermediate) existing.is_intermediate = true;
			if (data.is_module_synthetic) existing.is_module_synthetic = true;
			if (data.displayName) existing.name = data.displayName;
		}
		return id;
	}

	registerCookware(name: string): string {
		const cleanedName = cleanRegistryName(name);
		const id = slugify(cleanedName);
		if (!this.cookware.has(id)) {
			this.cookware.set(id, { id, name: cleanedName });
		}
		return id;
	}

	getIngredientId(name: string): string {
		return slugify(name);
	}

	toPlainObject() {
		return {
			ingredients: Object.fromEntries(this.ingredients),
			cookware: Object.fromEntries(this.cookware),
		};
	}
}
