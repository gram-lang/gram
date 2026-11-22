import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { AmbiguousMultiUnitError, resolveScaleFactor } from "../src/scale";
import type { CompositeItem } from "../src/shopping";

// A composite parent's amounts only add up within one unit (one ladder:
// `g` and `kg`). Before this fix the parent kept the number of each draw and
// dropped its unit, so `@beurre{100 g}` and `@noisette<@beurre{2}` bought
// "102 beurre", and a second direct use of the parent in another unit
// overwrote the first one.
function composites(body: string): CompositeItem[] {
	const source = `---\ntitle: 'T'\n---\n\n## Prep\n\n${body}\n`;
	return compile(getAST(source)).shopping_list.filter(
		(i): i is CompositeItem => i.type === "composite",
	);
}

function byUnit(items: CompositeItem[], unit: string | undefined) {
	return items.find((i) => (i.unit ?? undefined) === unit);
}

function childIds(item: CompositeItem | undefined): string[] {
	return (item?.usage ?? [])
		.map((u) => `${u.id}${u.alias ? `:${u.alias}` : ""}`)
		.sort();
}

describe("composite parent units", () => {
	it("keeps the unit of a parent drawn in one unit", () => {
		const items = composites("Clarifier @clarifie<@beurre{100 g}.");
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ id: "beurre", qty: 100, unit: "g" });
		expect(items[0]?.multiUnit).toBeUndefined();
	});

	it("never adds a direct use in grams to a draw counted in pieces", () => {
		const items = composites(
			"Fondre @beurre{100 g}.\n\nAjouter @noisette<@beurre{2}.",
		);
		expect(items).toHaveLength(2);
		expect(byUnit(items, "g")).toMatchObject({ qty: 100, multiUnit: true });
		expect(childIds(byUnit(items, "g"))).toEqual(["beurre:Direct Use"]);
		expect(byUnit(items, undefined)).toMatchObject({ qty: 2, multiUnit: true });
		expect(childIds(byUnit(items, undefined))).toEqual(["noisette"]);
	});

	it("never adds two draws of one child in different units", () => {
		const items = composites(
			"Faire @clarifie<@beurre{100 g}.\n\nFaire @clarifie<@beurre{2}.",
		);
		expect(items).toHaveLength(2);
		expect(byUnit(items, "g")?.qty).toBe(100);
		expect(byUnit(items, undefined)?.qty).toBe(2);
	});

	it("never compares draws of two children in different units", () => {
		const items = composites(
			"Faire @clarifie<@beurre{100 g}.\n\nFaire @noisette<@beurre{2}.",
		);
		expect(items).toHaveLength(2);
		expect(byUnit(items, "g")?.qty).toBe(100);
		expect(childIds(byUnit(items, "g"))).toEqual(["clarifie"]);
		expect(byUnit(items, undefined)?.qty).toBe(2);
		expect(childIds(byUnit(items, undefined))).toEqual(["noisette"]);
	});

	it("keeps every direct use of the parent, one per unit", () => {
		const items = composites(
			"Fondre @beurre{100 g}.\n\nFondre @beurre{2}.\n\nAjouter @noisette<@beurre{1}.",
		);
		expect(items).toHaveLength(2);
		expect(byUnit(items, "g")).toMatchObject({ qty: 100, multiUnit: true });
		expect(childIds(byUnit(items, "g"))).toEqual(["beurre:Direct Use"]);
		expect(byUnit(items, undefined)).toMatchObject({ qty: 3, multiUnit: true });
		expect(childIds(byUnit(items, undefined))).toEqual([
			"beurre:Direct Use",
			"noisette",
		]);
	});

	it("adds up the units of one ladder in a single entry", () => {
		const items = composites(
			"Faire @clarifie<@beurre{100 g}.\n\nFaire @noisette<@beurre{1 kg}.\n\nFondre @beurre{50 g}.",
		);
		expect(items).toHaveLength(1);
		// The largest draw (1 kg) plus the direct use (50 g).
		expect(items[0]).toMatchObject({ qty: 1050, unit: "g" });
		expect(items[0]?.multiUnit).toBeUndefined();
	});

	it("leaves a parent counted in pieces as it was", () => {
		const items = composites(
			"Séparer @blancs{2}<@oeufs{2}.\n\nBattre @jaunes{3}<@oeufs{3}.\n\nCasser @oeufs{1}.",
		);
		expect(items).toHaveLength(1);
		// The largest draw (3) plus the direct use (1).
		expect(items[0]?.qty).toBe(4);
		expect("unit" in (items[0] as object)).toBe(false);
		expect(items[0]?.multiUnit).toBeUndefined();
	});

	it("scales on a parent drawn in grams, by a target in grams", () => {
		const source =
			"---\ntitle: 'T'\n---\n\n## Prep\n\nClarifier @clarifie<@beurre{100 g}.\n";
		const resolution = resolveScaleFactor(compile(getAST(source)), {
			type: "target",
			id: "beurre",
			qty: 200,
			unit: "g",
		});
		expect(resolution.factor).toBe(2);
	});

	it("refuses a parent drawn in two units as a scale target", () => {
		const source =
			"---\ntitle: 'T'\n---\n\n## Prep\n\nFaire @clarifie<@beurre{100 g}.\n\nAjouter @noisette<@beurre{2}.\n";
		expect(() =>
			resolveScaleFactor(compile(getAST(source)), {
				type: "target",
				id: "beurre",
				qty: 4,
				unit: null,
			}),
		).toThrow(AmbiguousMultiUnitError);
	});
});
