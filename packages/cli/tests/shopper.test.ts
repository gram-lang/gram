import { describe, it, expect, afterEach } from "bun:test";
import { buildShoppingList } from "../src/services/shopper";
import { renderShopJson } from "../src/ui/shop";
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

	it("writes 1000 g or more in kg and 1000 ml or more in l, as the recipe view does", async () => {
		const a = await tmp(
			"## Prep\n[Mix] Add @flour{1500g} and @milk{1000ml}.\n",
		);
		const b = await tmp(
			"## Prep\n[Mix] Add @flour{1500g} and @milk{1000ml}.\n",
		);
		const result = await buildShoppingList([a, b]);
		expect(result.items.find((i) => i.id === "flour")?.displayQty).toBe("3 kg");
		expect(result.items.find((i) => i.id === "milk")?.displayQty).toBe("2 l");
	});

	it("writes decimals in the project's language, not the machine's", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{1950g} and @milk{1.5l}.\n");
		const b = await tmp("## Prep\n[Mix] Add @flour{1950g} and @milk{1.25l}.\n");
		const fr = await buildShoppingList([a, b], { lang: "fr" });
		expect(fr.items.find((i) => i.id === "flour")?.displayQty).toBe("3,9 kg");
		expect(fr.items.find((i) => i.id === "milk")?.displayQty).toBe("2,75 l");
		const en = await buildShoppingList([a, b], { lang: "en" });
		expect(en.items.find((i) => i.id === "flour")?.displayQty).toBe("3.9 kg");
	});

	it("writes cups and spoons in fractions, whether written 1 3/4 or 1.75", async () => {
		const a = await tmp(
			"## Prep\n[Mix] Add @flour{1 3/4 cup} and @sugar{1.75 cup}.\n",
		);
		const b = await tmp(
			"## Prep\n[Mix] Add @flour{1 cup} and @salt{1.5 tsp}.\n",
		);
		const result = await buildShoppingList([a, b]);
		expect(result.items.find((i) => i.id === "flour")?.displayQty).toBe(
			"2 3/4 cup",
		);
		expect(result.items.find((i) => i.id === "sugar")?.displayQty).toBe(
			"1 3/4 cup",
		);
		expect(result.items.find((i) => i.id === "salt")?.displayQty).toBe(
			"1 1/2 tsp",
		);
	});

	it("lists an ingredient with no quantity as '-'", async () => {
		const a = await tmp("## Prep\n[Season] Add @salt{} to taste.\n");
		const result = await buildShoppingList([a]);
		const salt = result.items.find((i) => i.id === "salt");
		expect(salt?.displayQty).toBe("-");
		expect(salt?.cannotAggregate).toBe(false);
	});

	// An entry the compiler could only describe (here a percentage of an
	// intermediate that does not exist) used to be dropped from the list.
	it("keeps a quantity it cannot compute, as written, after the total", async () => {
		const a = await tmp(
			"## Prep\n\n[Season] Add @salt{2% &dough} and @salt{3 g}.\n",
		);
		const result = await buildShoppingList([a]);
		const salt = result.items.find((i) => i.id === "salt");
		expect(salt?.displayQty).toBe("3 g + (2% of dough ❓)");
	});

	it("lists an ingredient with only such a quantity", async () => {
		const a = await tmp("## Prep\n\n[Season] Add @salt{2% &dough}.\n");
		const result = await buildShoppingList([a]);
		const salt = result.items.find((i) => i.id === "salt");
		expect(salt?.displayQty).toBe("(2% of dough ❓)");
	});

	it("adds up sums of quantities by unit ladder and writes them as the recipe view does", async () => {
		const a = await tmp(
			"## Prep\n\n[Mix] Add @flour{2 cups + 2 tbsp}, @sugar{3/4 cup + 1-2 tbsp} and @chips{1 1/2 cups + 50 g}.\n",
		);
		const b = await tmp(
			"## Prep\n\n[Mix] Add @flour{1 tbsp} and @chips{20 g}.\n",
		);
		const result = await buildShoppingList([a, b]);
		const find = (id: string) => result.items.find((i) => i.id === id);
		// 34 tbsp + 1 tbsp across two recipes, one ladder: recomposed.
		expect(find("flour")?.displayQty).toBe("2 cup + 3 tbsp");
		expect(find("flour")?.cannotAggregate).toBe(false);
		// A range is added by its bounds, never shown as its middle.
		expect(find("sugar")?.displayQty).toBe("13-14 tbsp");
		// A volume and a weight stay apart, each written in full.
		expect(find("chips")?.displayQty).toBe("1 1/2 cups + 70 g");
		expect(find("chips")?.cannotAggregate).toBe(true);
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

	// Audit 2026-07-22, i18n finding F-03, Phase 18: a *stable key* persisted
	// in `category` (e.g. "vegetables", the new format `db-enricher` writes)
	// must resolve to the display label for `lang` before being grouped —
	// unlike the legacy-label test above, this exercises the actual F-03 key
	// format, and the resolved label genuinely differs by language (real
	// discrimination, not just a different code path for the same string).
	it("resolves a stable category key to the correct display label per language", async () => {
		const db = makeDb({ carotte: { category: "vegetables" } });
		const a = await tmp("## Prep\n[Mix] Add @carotte{100g}.\n");

		const french = await buildShoppingList([a], { db, lang: "fr" });
		expect([...french.byCategory.keys()]).toContain("Légumes");

		const english = await buildShoppingList([a], { db, lang: "en" });
		expect([...english.byCategory.keys()]).toContain("Vegetables");
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

	describe("amounts as numbers", () => {
		const numbers = (i?: { amount: unknown; unit: unknown }) => ({
			amount: i?.amount,
			unit: i?.unit,
		});

		it("gives the total as a number, in the unit the reader sees", async () => {
			const a = await tmp(
				"## Prep\n\n[Mix] Add @flour{200 g}, @rye{1950 g}, @eggs{2} and @cream{1 3/4 cup}.\n",
			);
			const b = await tmp(
				"## Prep\n\n[Mix] Add @flour{100 g}, @rye{1950 g} and @eggs{2}.\n",
			);
			const result = await buildShoppingList([a, b], { lang: "fr" });
			const find = (id: string) => result.items.find((i) => i.id === id);
			expect(numbers(find("flour"))).toEqual({ amount: 300, unit: "g" });
			// `3,9 kg` for the reader, a plain number for a script.
			expect(find("rye")?.displayQty).toBe("3,9 kg");
			expect(numbers(find("rye"))).toEqual({ amount: 3.9, unit: "kg" });
			expect(numbers(find("eggs"))).toEqual({ amount: 4, unit: null });
			expect(numbers(find("cream"))).toEqual({ amount: 1.75, unit: "cup" });
			expect(find("flour")?.parts).toBeUndefined();
			expect(find("flour")?.range).toBeUndefined();
		});

		it("gives a ladder's total in its smallest unit, canonical", async () => {
			const a = await tmp(
				"## Prep\n\n[Mix] Add @flour{2 cups + 2 tbsp} and @oil{2 tablespoons}.\n",
			);
			const b = await tmp(
				"## Prep\n\n[Mix] Add @flour{1 tbsp} and @oil{1 c. à s.}.\n",
			);
			const result = await buildShoppingList([a, b], { lang: "fr" });
			const find = (id: string) => result.items.find((i) => i.id === id);
			expect(find("flour")?.displayQty).toBe("2 cup + 3 tbsp");
			expect(numbers(find("flour"))).toEqual({ amount: 35, unit: "tbsp" });
			expect(numbers(find("oil"))).toEqual({ amount: 3, unit: "tbsp" });
		});

		it("gives a range its middle and its bounds, in the unit of its upper bound", async () => {
			const a = await tmp(
				"## Prep\n\n[Mix] Add @sugar{3/4 cup + 1-2 tbsp} and @rice{800-1100 g}.\n",
			);
			const result = await buildShoppingList([a]);
			const find = (id: string) => result.items.find((i) => i.id === id);
			expect(find("sugar")).toMatchObject({
				amount: 13.5,
				unit: "tbsp",
				range: { min: 13, max: 14 },
			});
			expect(find("rice")?.displayQty).toBe("0.8-1.1 kg");
			expect(find("rice")).toMatchObject({
				amount: 0.95,
				unit: "kg",
				range: { min: 0.8, max: 1.1 },
			});
		});

		it("gives the mass worked out with the database", async () => {
			const db = makeDb({
				milk: { physical: { density: 1.03 } },
				cream: { physical: { density: 1 } },
			});
			const a = await tmp(
				"## Prep\n\n[Pour] Add @milk{500 ml} and @cream{1 l}.\n",
			);
			const b = await tmp(
				"## Prep\n\n[Pour] Add @milk{200 g} and @cream{200 g}.\n",
			);
			const result = await buildShoppingList([a, b], { db });
			const find = (id: string) => result.items.find((i) => i.id === id);
			expect(numbers(find("milk"))).toEqual({ amount: 715, unit: "g" });
			expect(find("cream")?.displayQty).toBe("1.2 kg");
			expect(numbers(find("cream"))).toEqual({ amount: 1.2, unit: "kg" });
		});

		it("has no number for an ingredient without one", async () => {
			const a = await tmp(
				"## Prep\n\n[Season] Add @salt{} and @pepper{2% &dough}.\n",
			);
			const result = await buildShoppingList([a]);
			const find = (id: string) => result.items.find((i) => i.id === id);
			expect(numbers(find("salt"))).toEqual({ amount: null, unit: null });
			expect(find("salt")?.unresolved).toBeUndefined();
			expect(numbers(find("pepper"))).toEqual({ amount: null, unit: null });
			expect(find("pepper")?.unresolved).toEqual(["(2% of dough ❓)"]);
			expect(find("pepper")?.parts).toBeUndefined();
		});

		it("says what the number leaves out", async () => {
			const a = await tmp(
				"## Prep\n\n[Season] Add @salt{2% &dough} and @salt{3 g}.\n",
			);
			const result = await buildShoppingList([a]);
			const salt = result.items.find((i) => i.id === "salt");
			expect(salt?.displayQty).toBe("3 g + (2% of dough ❓)");
			expect(numbers(salt)).toEqual({ amount: 3, unit: "g" });
			expect(salt?.unresolved).toEqual(["(2% of dough ❓)"]);
		});

		it("lists the amounts whose units do not add up in parts, as displayQty writes them", async () => {
			const a = await tmp(
				"## Prep\n\n[Mix] Add @butter{2 tbsp} and @chips{1 1/2 cups + 50 g}.\n",
			);
			const b = await tmp(
				"## Prep\n\n[Mix] Add @butter{50 g}, @butter{1 tablespoon} and @chips{20 g}.\n",
			);
			const result = await buildShoppingList([a, b]);
			const find = (id: string) => result.items.find((i) => i.id === id);
			expect(find("butter")?.displayQty).toBe("3 tbsp + 50 g");
			expect(find("butter")).toMatchObject({
				amount: null,
				unit: null,
				parts: [
					{ amount: 3, unit: "tbsp" },
					{ amount: 50, unit: "g" },
				],
			});
			expect(find("chips")?.displayQty).toBe("1 1/2 cups + 70 g");
			expect(find("chips")?.parts).toEqual([
				{ amount: 1.5, unit: "cup" },
				{ amount: 70, unit: "g" },
			]);
		});

		it("writes them in the JSON output, parts and unresolved only when there are some", async () => {
			const a = await tmp(
				"## Prep\n\n[Mix] Add @flour{200 g}, @chips{1 cup + 50 g} and @salt{2% &dough}.\n",
			);
			const json = JSON.parse(
				renderShopJson(await buildShoppingList([a], { lang: "fr" })),
			);
			const find = (id: string) =>
				json.items.find((i: { id: string }) => i.id === id);
			expect(find("flour")).toEqual({
				id: "flour",
				name: "flour",
				qty: "200 g",
				amount: 200,
				unit: "g",
				isEstimate: false,
				category: "Autres",
				recipes: [expect.any(String)],
			});
			expect(find("chips").parts).toEqual([
				{ amount: 1, unit: "cup" },
				{ amount: 50, unit: "g" },
			]);
			expect(find("salt").unresolved).toEqual(["(2% of dough ❓)"]);
			expect("parts" in find("salt")).toBe(false);
		});
	});
});
