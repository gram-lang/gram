import pLimit from "p-limit";
import { basename } from "node:path";
import {
	normalizeUnit,
	getDefaultCategories,
	getCategoryLabels,
	isCategoryKey,
} from "@gram-lang/i18n";
import { runPipeline } from "../core/pipeline";
import { fmtNumber } from "../core/format";
import type { IngredientData } from "@gram-lang/analyzer";
import { resolveCanonicalId } from "@gram-lang/analyzer";
import type { ShopResult, ShoppingEntry } from "../types";

export interface ShopOptions {
	db?: Record<string, IngredientData> | null;
	scaleFactor?: number;
	lang?: string;
}

interface CollectedItem {
	id: string;
	name: string;
	qty: number | null; // null = ingredient present but no quantity specified
	unit?: string;
	normalizedMass?: number;
	isEstimate?: boolean;
	recipe: string;
}

function formatMass(grams: number): string {
	if (grams >= 1000) return `${fmtNumber(grams / 1000)} kg`;
	return `${fmtNumber(Math.round(grams), 0)} g`;
}

// This used to be its own hardcoded list that didn't match the canonical
// categories i18n defines — not even in English ("Fish" vs "Seafood",
// "Produce" vs "Vegetables", "Fat" vs "Oils", "Spice" vs "Spices"). A
// category from the ingredient DB that doesn't match any entry here just
// sorts alphabetically after the matched ones (see below), so this is
// purely the preferred sort order, not a validation list. It now follows
// the project's declared language (`opts.lang`, resolved per call, not a
// module-level constant computed once at import time).

export async function buildShoppingList(
	files: string[],
	opts: ShopOptions = {},
): Promise<ShopResult> {
	const lang = opts.lang ?? "en";
	const categoryOrder = getDefaultCategories(lang);
	const categoryLabels = getCategoryLabels(lang);
	const limit = pLimit(20);
	const allItems: CollectedItem[] = [];

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
		files.map((file) =>
			limit(async () => {
				const slug = basename(file, ".gram");

				const pushItem = (item: any) => {
					if (
						(item as any).type === "alternative" ||
						(item as any).variable_entries
					)
						return;
					const qty =
						typeof item.qty === "number" && Number.isFinite(item.qty)
							? item.qty
							: null;
					// Resolve aliases (e.g. "beurre"/"butter") to a shared canonical id so recipes
					// that name the same ingredient differently still get grouped together.
					const id = opts.db
						? resolveCanonicalId(item.name ?? item.id, opts.db)
						: item.id;
					allItems.push({
						id,
						name: item.name,
						qty,
						unit: item.unit,
						normalizedMass: item.normalizedMass,
						isEstimate: item.isEstimate,
						recipe: slug,
					});
				};

				if (opts.db) {
					const { analyzed } = await runPipeline(file, {
						db: opts.db,
						scaleFactor: opts.scaleFactor,
						lang: opts.lang,
					});
					if (analyzed) {
						for (const item of analyzed.result.shopping_list as any[])
							pushItem(item);
					}
				} else {
					const { compiled } = await runPipeline(file, {
						skipAnalyzer: true,
						scaleFactor: opts.scaleFactor,
						lang: opts.lang,
					});
					for (const item of compiled.shopping_list as any[]) pushItem(item);
				}
			}),
		),
	);

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

		const qtyItems = items.filter(
			(i): i is CollectedItem & { qty: number } => i.qty !== null,
		);

		if (qtyItems.length === 0) {
			entries.push({
				id,
				name: displayName,
				displayQty: "-",
				isEstimate: false,
				recipes,
				category,
				cannotAggregate: false,
			});
			continue;
		}

		let fullyAggregated = false;
		let finalEntry: Partial<ShoppingEntry> = {};

		if (opts.db) {
			const massItems = qtyItems.filter((i) => i.normalizedMass != null);
			if (massItems.length === qtyItems.length) {
				const totalMass = massItems.reduce(
					(sum, i) => sum + (i.normalizedMass ?? 0),
					0,
				);
				fullyAggregated = true;
				finalEntry = {
					displayQty: formatMass(totalMass),
					isEstimate: massItems.some((i) => i.isEstimate),
				};
			}
		}

		if (!fullyAggregated) {
			const units = new Set(qtyItems.map((i) => normalizeUnit(i.unit)));
			if (units.size === 1) {
				const total = qtyItems.reduce((sum, i) => sum + i.qty, 0);
				const unit = normalizeUnit(qtyItems[0]?.unit);
				fullyAggregated = true;
				finalEntry = {
					displayQty: unit ? `${fmtNumber(total)} ${unit}` : fmtNumber(total),
					isEstimate: false,
				};
			}
		}

		if (fullyAggregated) {
			entries.push({
				id,
				name: displayName,
				displayQty: finalEntry.displayQty!,
				isEstimate: finalEntry.isEstimate!,
				recipes,
				category,
				cannotAggregate: false,
			});
		} else {
			const unitList = [
				...new Set(qtyItems.map((u) => u.unit || "count")),
			].join(", ");
			const tip = opts.db
				? "add density to database to aggregate"
				: "add to database to aggregate";
			warnings.push(
				`${id}: mixed units (${unitList}) — listed separately (${tip})`,
			);
			entries.push({
				id,
				name: displayName,
				displayQty: qtyItems
					.map((i) => `${i.qty}${i.unit ? ` ${i.unit}` : ""} (${i.recipe})`)
					.join(" + "),
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
	};
}
