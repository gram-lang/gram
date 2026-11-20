import pLimit from "p-limit";
import { basename } from "node:path";
import {
	getDefaultCategories,
	getCategoryLabels,
	isCategoryKey,
	mergeTerms,
	normalizeUnit,
	round2,
	type Term,
	termValueNumber,
	toLargerMetricUnit,
	UNIT_CONVERSIONS,
} from "@gram-lang/i18n";
import { termsOfUsage } from "@gram-lang/kitchen";
import { runPipeline } from "../core/pipeline";
import { formatUsageQuantity, type RecipeSettings } from "@gram-lang/renderer";
import { fmtNumber } from "../core/format";
import type {
	IngredientData,
	AnalyzedCompilationResult,
} from "@gram-lang/analyzer";
import { resolveCanonicalId } from "@gram-lang/analyzer";
import type {
	ShopResult,
	ShoppingAmount,
	ShoppingEntry,
	ModuleResolutionOptions,
} from "../types";

export interface ShopOptions extends ModuleResolutionOptions {
	db?: Record<string, IngredientData> | null;
	/** What the analyzer computes. Default: everything, as the engine. */
	recipe?: RecipeSettings;
	scaleFactor?: number;
	lang?: string;
}

interface CollectedItem {
	id: string;
	name: string;
	/** The amount, as terms (`termsOfUsage`): empty when none is given. */
	terms: Term[];
	normalizedMass?: number;
	isEstimate?: boolean;
	/**
	 * What the compiler could not turn into a number (a relative quantity
	 * whose base is missing, a circular reference): shown as written after
	 * the total, never dropped.
	 */
	extras?: string[];
	recipe: string;
	/** The file's place on the command line: amounts follow it, not read order. */
	fileIndex: number;
}

/** A mass in grams on the shopping list, 1000 g or more in kg: as numbers and as written. */
function shoppingMass(
	grams: number,
	lang: string,
): { amount: ShoppingAmount; text: string } {
	const { value, unit } = toLargerMetricUnit(grams, "g");
	return {
		amount: { amount: value, unit },
		text: `${fmtNumber(value, unit === "g" ? 0 : 2, lang)} ${unit}`,
	};
}

/** How many `to` one `from` makes, two metric units of one kind (`g` to `kg`: 0.001). */
function metricRatio(from: string, to: string, lang: string): number {
	const canonical = normalizeUnit(from, lang);
	for (const { map } of [UNIT_CONVERSIONS.mass, UNIT_CONVERSIONS.volume]) {
		const a = map[canonical];
		const b = map[to];
		if (a !== undefined && b !== undefined) return a / b;
	}
	return 1;
}

/**
 * One term of the total as numbers, in the unit `displayQty` writes it in:
 * 1000 g or more in kg, decided on the upper bound of a range as the recipe
 * view does (`800-1100 g` is `0.8-1.1 kg`). A term taken away is negative.
 * The unit is canonical (`tbsp` for `tablespoons` or `c. à s.`), so a script
 * reads one spelling. `null` when the term holds no number.
 */
function amountOf(term: Term, lang: string): ShoppingAmount | null {
	const middle = termValueNumber(term.value);
	if (middle === null) return null;
	const bounds =
		typeof term.value === "object" && term.value.type === "range"
			? term.value.range
			: undefined;
	let unit = term.unit || null;
	let factor = term.minus ? -1 : 1;
	if (unit && !term.minus) {
		const larger = toLargerMetricUnit(bounds?.max ?? middle, unit, lang).unit;
		if (larger !== unit) {
			factor = metricRatio(unit, larger, lang);
			unit = larger;
		}
	}
	const num = (n: number) => round2(n * factor);
	const amount: ShoppingAmount = {
		amount: num(middle),
		unit: unit ? normalizeUnit(unit, lang) : null,
	};
	if (bounds) {
		const [a, b] = [num(bounds.min), num(bounds.max)];
		amount.range = { min: Math.min(a, b), max: Math.max(a, b) };
	}
	return amount;
}

const NO_AMOUNT = { amount: null, unit: null } as const;

// This used to be its own hardcoded list that didn't match the canonical
// categories i18n defines — not even in English ("Fish" vs "Seafood",
// "Produce" vs "Vegetables", "Fat" vs "Oils", "Spice" vs "Spices"). A
// category from the ingredient DB that doesn't match any entry here just
// sorts alphabetically after the matched ones (see below), so this is
// purely the preferred sort order, not a validation list. It now follows
// the project's declared language (`opts.lang`, resolved per call, not a
// module-level constant computed once at import time).

const isScaledFactor = (factor: number | undefined): boolean =>
	typeof factor === "number" && factor !== 1;

export async function buildShoppingList(
	files: string[],
	opts: ShopOptions = {},
): Promise<ShopResult> {
	const lang = opts.lang ?? "en";
	const categoryOrder = getDefaultCategories(lang);
	const categoryLabels = getCategoryLabels(lang);
	const limit = pLimit(20);
	const allItems: CollectedItem[] = [];
	const usedStock = new Set<string>();
	// Shared across every file in this batch (module-imports RFC §F.1) — a
	// base imported by several of these recipes is measured once.
	const moduleCache = new Map<string, AnalyzedCompilationResult>();

	// `IngredientData.category` stores a stable key (e.g. "vegetables") going
	// forward, but a database
	// enriched before this fix — or authored by hand — may still have a
	// translated label ("Vegetables"/"Légumes") written there directly.
	// Resolve a recognized key to its display label; anything else (a legacy
	// label, or free text) passes through unchanged, matching prior behavior.
	function resolveCategoryLabel(raw: string | undefined): string {
		if (!raw) return categoryLabels.other;
		return isCategoryKey(raw) ? categoryLabels[raw] : raw;
	}

	await Promise.all(
		files.map((file, fileIndex) =>
			limit(async () => {
				const slug = basename(file, ".gram");

				const pushItem = (item: any) => {
					if ((item as any).type === "alternative") return;
					const extras = Array.isArray(item.variable_entries)
						? item.variable_entries.filter(
								(e: unknown): e is string => typeof e === "string",
							)
						: [];
					// Resolve aliases (e.g. "beurre"/"butter") to a shared canonical id so recipes
					// that name the same ingredient differently still get grouped together.
					const id = opts.db
						? resolveCanonicalId(item.name ?? item.id, opts.db)
						: item.id;
					allItems.push({
						id,
						name: item.name,
						terms: termsOfUsage(item),
						normalizedMass: item.normalizedMass,
						isEstimate: item.isEstimate,
						...(extras.length > 0 ? { extras } : {}),
						recipe: slug,
						fileIndex,
					});
				};

				const {
					compiled,
					analyzed,
					usedStock: fileUsedStock,
				} = await runPipeline(file, {
					db: opts.db,
					recipe: opts.recipe,
					scaleFactor: opts.scaleFactor,
					lang: opts.lang,
					paths: opts.paths,
					stock: opts.stock,
					moduleCache,
				});
				fileUsedStock.forEach((u) => {
					usedStock.add(u);
				});
				if (analyzed) {
					for (const item of analyzed.result.shopping_list as any[])
						pushItem(item);
				} else {
					for (const item of compiled.shopping_list as any[]) pushItem(item);
				}
			}),
		),
	);

	// Files are read in parallel: put their items back in command-line order,
	// so a total reads the same on every run (`1 1/2 cups + 70 g`).
	allItems.sort((a, b) => a.fileIndex - b.fileIndex);
	const grouped = new Map<string, CollectedItem[]>();
	for (const item of allItems) {
		const bucket = grouped.get(item.id) ?? [];
		bucket.push(item);
		grouped.set(item.id, bucket);
	}

	const entries: ShoppingEntry[] = [];
	const warnings: string[] = [];

	for (const [id, items] of grouped) {
		const recipes = [...new Set(items.map((i) => i.recipe))];
		const displayName = items[0]?.name ?? id;
		const category = resolveCategoryLabel(opts.db?.[id]?.category);
		const unresolved = items.flatMap((i) => i.extras ?? []);
		const extras = unresolved.join(" + ");
		const withExtras = (displayQty: string) =>
			extras ? `${displayQty} + ${extras}` : displayQty;
		// Never counted in `amount`: a script sees the total is not complete.
		const unresolvedField = unresolved.length > 0 ? { unresolved } : {};

		const qtyItems = items.filter((i) => i.terms.length > 0);

		if (qtyItems.length === 0) {
			entries.push({
				id,
				name: displayName,
				displayQty: extras || "-",
				...NO_AMOUNT,
				...unresolvedField,
				isEstimate: false,
				recipes,
				category,
				cannotAggregate: false,
			});
			continue;
		}

		let total: {
			displayQty: string;
			amount: ShoppingAmount | null;
			isEstimate: boolean;
		} | null = null;

		if (opts.db) {
			const massItems = qtyItems.filter((i) => i.normalizedMass != null);
			if (massItems.length === qtyItems.length) {
				const totalMass = massItems.reduce(
					(sum, i) => sum + (i.normalizedMass ?? 0),
					0,
				);
				const mass = shoppingMass(Math.round(totalMass), lang);
				total = {
					displayQty: mass.text,
					amount: mass.amount,
					isEstimate: massItems.some((i) => i.isEstimate),
				};
			}
		}

		// Added up as the recipe view's shopping list does: one unit, or the
		// units of one ladder (cups and spoons, kg and g), ranges by their
		// bounds; written the way it is bought (`2 cup + 2 tbsp`, `1.5 kg`).
		const merged = mergeTerms(
			qtyItems.flatMap((i) => i.terms),
			"ladder",
		);
		const amount = formatUsageQuantity(
			{ terms: merged },
			{ lang, buying: true, scaled: isScaledFactor(opts.scaleFactor) },
		);
		if (!total && merged.length === 1) {
			total = {
				displayQty: amount,
				amount: amountOf(merged[0] as Term, lang),
				isEstimate: false,
			};
		}

		if (total) {
			entries.push({
				id,
				name: displayName,
				displayQty: withExtras(total.displayQty),
				...(total.amount ?? NO_AMOUNT),
				...unresolvedField,
				isEstimate: total.isEstimate,
				recipes,
				category,
				cannotAggregate: false,
			});
		} else {
			const unitList = [...new Set(merged.map((t) => t.unit || "count"))].join(
				", ",
			);
			const tip = opts.db
				? "add density to database to aggregate"
				: "add to database to aggregate";
			warnings.push(
				`${id}: mixed units (${unitList}) — listed separately (${tip})`,
			);
			entries.push({
				id,
				name: displayName,
				displayQty: withExtras(amount),
				...NO_AMOUNT,
				// The same terms `displayQty` writes, one per unit that adds up.
				parts: merged.flatMap((t) => amountOf(t, lang) ?? []),
				...unresolvedField,
				isEstimate: false,
				recipes,
				category,
				cannotAggregate: true,
			});
		}
	}

	entries.sort((a, b) => a.name.localeCompare(b.name));

	const byCategory = new Map<string, ShoppingEntry[]>();
	for (const entry of entries) {
		const bucket = byCategory.get(entry.category) ?? [];
		bucket.push(entry);
		byCategory.set(entry.category, bucket);
	}

	const sortedByCategory = new Map(
		[...byCategory.entries()].sort(([a], [b]) => {
			const ai = categoryOrder.indexOf(a);
			const bi = categoryOrder.indexOf(b);
			if (ai !== -1 && bi !== -1) return ai - bi;
			if (ai !== -1) return -1;
			if (bi !== -1) return 1;
			return a.localeCompare(b);
		}),
	);

	const uniqueRecipes = new Set(allItems.map((i) => i.recipe));

	return {
		items: entries,
		byCategory: sortedByCategory,
		warnings,
		recipeCount: uniqueRecipes.size,
		usedStock,
	};
}
