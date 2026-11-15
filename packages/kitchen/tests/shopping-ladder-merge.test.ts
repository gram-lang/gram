import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { applyScale, resolveScaleFactor } from "../src/scale";
import type { ShoppingListItem } from "../src/shopping";

// Since 1.5.0 the shopping list adds up the units of one ladder (`cup` and
// `tbsp`, `g` and `kg`) in one entry, in the smallest unit written, and adds
// ranges by their bounds. Two systems or two families stay apart.
function compiled(body: string) {
	const source = `---\ntitle: 'T'\n---\n\n## Section\n\n${body}\n`;
	return compile(getAST(source));
}

function entriesOf(body: string, id: string): ShoppingListItem[] {
	return (compiled(body).shopping_list as ShoppingListItem[]).filter(
		(i) => i.id === id,
	);
}

describe("shopping list: units of one ladder", () => {
	it("adds up the units of one ladder in the smallest unit written", () => {
		const flour = entriesOf("@flour{1 cup} then @flour{2 tbsp}.", "flour");
		expect(flour).toHaveLength(1);
		expect(flour[0]).toMatchObject({ qty: 18, unit: "tbsp" });
		expect(flour[0]?.multiUnit).toBeUndefined();
	});

	it("adds up metric units of one family", () => {
		const flour = entriesOf("@flour{1 kg} then @flour{200 g}.", "flour");
		expect(flour).toHaveLength(1);
		expect(flour[0]).toMatchObject({ qty: 1200, unit: "g" });
	});

	it("adds a sum to the occurrences of its ladder", () => {
		const sugar = entriesOf(
			"@sugar{2 tbsp} then @sugar{1 cup - 4 tbsp}.",
			"sugar",
		);
		expect(sugar).toHaveLength(1);
		expect(sugar[0]).toMatchObject({ qty: 14, unit: "tbsp" });
	});

	it("keeps two systems apart, flagged as mixed units", () => {
		const milk = entriesOf("@milk{1 cup} then @milk{100 ml}.", "milk");
		expect(milk.map((i) => [i.qty, i.unit])).toEqual([
			[1, "cup"],
			[100, "ml"],
		]);
		expect(milk.every((i) => i.multiUnit)).toBe(true);
	});

	it("buys a sum over two systems as if it had been written apart", () => {
		const milk = entriesOf("@milk{1 cup + 10 ml} then @milk{1 tbsp}.", "milk");
		expect(milk.map((i) => [i.qty, i.unit])).toEqual([
			[17, "tbsp"],
			[10, "ml"],
		]);
	});

	it("gives the same list however the amounts are grouped in writing", () => {
		// A sum counts as its terms written apart: the shopping list never
		// depends on whether the recipe wrote one sum or several occurrences.
		const shapes = (body: string) =>
			entriesOf(body, "milk").map((i) => [i.qty, i.unit, i.multiUnit]);
		const expected = [
			[2, "cup", true],
			[50, "ml", true],
		];
		expect(shapes("@milk{1 cup + 50 ml} then @milk{1 cup}.")).toEqual(expected);
		expect(shapes("@milk{1 cup} then @milk{50 ml} then @milk{1 cup}.")).toEqual(
			expected,
		);
		expect(shapes("@milk{2 cups + 50 ml}.")).toEqual([
			[2, "cups", true],
			[50, "ml", true],
		]);
	});

	it("keeps the singular and plural of a unit it does not know apart", () => {
		const garlic = entriesOf("@ail{1 gousse} puis @ail{2 gousses}.", "ail");
		expect(garlic.map((i) => [i.qty, i.unit])).toEqual([
			[1, "gousse"],
			[2, "gousses"],
		]);
	});
});

describe("shopping list: ranges", () => {
	it("adds ranges by their bounds, the middle in qty", () => {
		const [salt] = entriesOf("@salt{2-3 g} then @salt{200 g}.", "salt");
		expect(salt).toMatchObject({
			qty: 202.5,
			unit: "g",
			range: { min: 202, max: 203 },
		});
	});

	it("keeps a lone range's bounds", () => {
		const [salt] = entriesOf("@salt{2-3 g}.", "salt");
		expect(salt).toMatchObject({ qty: 2.5, range: { min: 2, max: 3 } });
	});

	it("adds a plain amount with no range field", () => {
		const [salt] = entriesOf("@salt{2 g} then @salt{3 g}.", "salt");
		expect(salt?.qty).toBe(5);
		expect(salt?.range).toBeUndefined();
	});

	it("scales the bounds with the middle", () => {
		const scaled = applyScale(compiled("@salt{2-3 g} then @salt{200 g}."), 2);
		const salt = (scaled.shopping_list as ShoppingListItem[]).find(
			(i) => i.id === "salt",
		);
		expect(salt).toMatchObject({ qty: 405, range: { min: 404, max: 406 } });
	});
});

describe("shopping list: scaling to a target", () => {
	it("accepts an ingredient whose units now share an entry", () => {
		// 1 cup + 4 tbsp = 20 tbsp: before 1.5 two entries, refused as mixed units.
		const { factor } = resolveScaleFactor(
			compiled("@flour{1 cup} then @flour{4 tbsp}."),
			{ type: "target", id: "flour", qty: 40, unit: "tbsp" },
		);
		expect(factor).toBe(2);
	});
});
