import { describe, it, expect, afterEach } from "bun:test";
import { buildShoppingList } from "../src/services/shopper";
import { writeTmpFile, cleanupTmpFile, makeDb } from "./helpers";

describe("buildShoppingList", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("aggregates the same ingredient/unit pair across multiple recipes", async () => {
		const a = await tmp("## Prep\n[Mix] Add the @flour{200g} to the bowl.\n");
		const b = await tmp("## Prep\n[Mix] Add the @flour{100g} to the bowl.\n");
		const result = await buildShoppingList([a, b]);
		const flour = result.items.find((i) => i.id === "flour");
		expect(flour?.displayQty).toBe("300 g");
		expect(flour?.cannotAggregate).toBe(false);
		expect(flour?.recipes).toHaveLength(2);
		expect(result.recipeCount).toBe(2);
	});

	it("lists an ingredient with no quantity as '-'", async () => {
		const a = await tmp("## Prep\n[Season] Add @salt{} to taste.\n");
		const result = await buildShoppingList([a]);
		const salt = result.items.find((i) => i.id === "salt");
		expect(salt?.displayQty).toBe("-");
		expect(salt?.cannotAggregate).toBe(false);
	});

	it("cannot aggregate mixed incompatible units without a database and reports a warning", async () => {
		const a = await tmp("## Prep\n[Mix] Add @butter{2 tbsp} to the bowl.\n");
		const b = await tmp("## Prep\n[Mix] Add @butter{50g} to the bowl.\n");
		const result = await buildShoppingList([a, b]);
		const butter = result.items.find((i) => i.id === "butter");
		expect(butter?.cannotAggregate).toBe(true);
		expect(result.warnings.some((w) => w.includes("butter"))).toBe(true);
		expect(result.warnings.some((w) => w.includes("add to database"))).toBe(
			true,
		);
	});

	it("aggregates across unit families via density when a database is provided", async () => {
		const db = makeDb({ milk: { physical: { density: 1.03 } } });
		const a = await tmp("## Prep\n[Pour] Add @milk{500 ml} to the bowl.\n");
		const b = await tmp("## Prep\n[Pour] Add @milk{200 g} to the bowl.\n");
		const result = await buildShoppingList([a, b], { db });
		const milk = result.items.find((i) => i.id === "milk");
		expect(milk?.cannotAggregate).toBe(false);
		// 500ml * 1.03 g/ml + 200g = 515 + 200 = 715g
		expect(milk?.displayQty).toBe("715 g");
	});

	it("merges recipes using different aliases of the same ingredient via the database", async () => {
		const db = makeDb({ butter: { aliases: ["beurre"] } });
		const a = await tmp("## Prep\n[Mix] Add @beurre{50g} to the bowl.\n");
		const b = await tmp("## Prep\n[Mix] Add @butter{100g} to the bowl.\n");
		const result = await buildShoppingList([a, b], { db });
		const entries = result.items.filter(
			(i) => i.id === "butter" || i.id === "beurre",
		);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.displayQty).toBe("150 g");
		expect(entries[0]?.recipes).toHaveLength(2);
	});

	it("uses the database display name and category when available", async () => {
		const db = makeDb({ flour: { name: "Wheat Flour", category: "Grains" } });
		const a = await tmp("## Prep\n[Mix] Add @flour{200g} to the bowl.\n");
		const result = await buildShoppingList([a], { db });
		const flour = result.items.find((i) => i.id === "flour");
		expect(flour?.name).toBe("Wheat Flour");
		expect(flour?.category).toBe("Grains");
	});

	it("keeps the recipe's own (non-English) name even with an English-only database", async () => {
		const db = makeDb({ flour: { aliases: ["farine"] } });
		const a = await tmp("## Prep\n[Mix] Add @farine{200g} to the bowl.\n");
		const result = await buildShoppingList([a], { db });
		const flour = result.items.find((i) => i.id === "flour");
		expect(flour?.name).toBe("farine");
	});

	it("defaults to category 'Other' without a database", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g} to the bowl.\n");
		const result = await buildShoppingList([a]);
		expect(result.items[0]?.category).toBe("Other");
	});

	it("groups entries by category, respecting the fixed category order, in byCategory", async () => {
		const db = makeDb({
			milk: { category: "Dairy" },
			carrot: { category: "Produce" },
		});
		const a = await tmp("## Prep\n[Mix] Add @milk{200g} and @carrot{100g}.\n");
		const result = await buildShoppingList([a], { db });
		const categories = [...result.byCategory.keys()];
		expect(categories.indexOf("Dairy")).toBeLessThan(
			categories.indexOf("Produce"),
		);
	});

	// Audit 2026-07-22, i18n finding F-04/F-07/F-08/F-09, Phase 17: this
	// resolves the file's own TODO(lang) — the category sort order used to be
	// a module-level constant fixed to English at import time, so a database
	// using French category names (a perfectly valid choice for a French
	// project) always sorted them as "unmatched" (alphabetically, after every
	// English-matched category) instead of in the intended French order. This
	// is a real, observable difference — unlike unit conversion (see
	// mass_standardization.test.ts's "lang parameter" tests), category names
	// genuinely differ in spelling between languages, so `lang` changes the
	// actual sort result, not just which code path resolves it.
	it("sorts by the French category order when lang is 'fr'", async () => {
		const db = makeDb({
			poivre: { category: "Épices" },
			carotte: { category: "Légumes" },
		});
		const a = await tmp("## Prep\n[Mix] Add @poivre{5g} and @carotte{100g}.\n");

		const french = await buildShoppingList([a], { db, lang: "fr" });
		const frenchCategories = [...french.byCategory.keys()];
		// "Légumes" (vegetables) comes first in the French canonical order;
		// "Épices" (spices) comes near the end.
		expect(frenchCategories.indexOf("Légumes")).toBeLessThan(
			frenchCategories.indexOf("Épices"),
		);

		// Without `lang` (or with "en"), neither French category name matches
		// the English canonical list, so both fall back to alphabetical
		// order — "Épices" sorts before "Légumes" (É < L) — the opposite of
		// the correct French order above.
		const noLang = await buildShoppingList([a], { db });
		const noLangCategories = [...noLang.byCategory.keys()];
		expect(noLangCategories.indexOf("Épices")).toBeLessThan(
			noLangCategories.indexOf("Légumes"),
		);
	});

	it("counts unique recipes even when an ingredient repeats within the same file", async () => {
		const a = await tmp(
			"## Prep\n[Mix] Add @flour{100g}.\n\n## Bake\n[Mix] Add more @flour{50g}.\n",
		);
		const result = await buildShoppingList([a]);
		expect(result.recipeCount).toBe(1);
		const flour = result.items.find((i) => i.id === "flour");
		expect(flour?.displayQty).toBe("150 g");
	});
});
