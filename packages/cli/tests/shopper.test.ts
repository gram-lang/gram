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
