import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { aggregateSectionIngredients } from "../src/section";
import {
	AmbiguousMultiUnitError,
	applyScale,
	resolveScaleFactor,
} from "../src/scale";
import { warningSeverity, WarningCode } from "../src/warnings";
import type { Usage } from "../src/types";

const recipe = (body: string) => compile(getAST(`## Section\n\n${body}\n`));
const ingredients = (body: string) =>
	(recipe(body).sections[0]?.ingredients ?? []) as Usage[];
const first = (body: string) => ingredients(body)[0] as Usage;
const warnings = (body: string, code: string) =>
	recipe(body).warnings.filter((w) => w.code === code);
/** The shopping list without the usage ids, for comparing two recipes. */
const shopping = (body: string) =>
	recipe(body).shopping_list.map((entry) => {
		const { _usageIds, ...rest } = entry as { _usageIds?: string[] };
		return rest;
	});

describe("a sum of one family", () => {
	it("keeps its terms in parts and its total in qty / unit", () => {
		expect(first("@flour{1 cup + 1 tbsp}.")).toMatchObject({
			qty: 17,
			unit: "tbsp",
			parts: [
				{ qty: 1, unit: "cup" },
				{ qty: 1, unit: "tbsp" },
			],
		});
	});

	it("marks a term taken away with minus: true", () => {
		const usage = first("@sugar{1 cup - 2 tbsp}.");
		expect(usage.qty).toBe(14);
		expect(usage.parts?.[1]).toEqual({ qty: 2, unit: "tbsp", minus: true });
		expect(usage.parts?.[0]).not.toHaveProperty("minus");
	});

	it("adds a range by its bounds", () => {
		expect(first("@milk{1 cup + 1-2 tbsp}.").qty).toMatchObject({
			type: "range",
			range: { min: 17, max: 18 },
		});
	});

	it("keeps @= on a sum", () => {
		expect(first("@=salt{1 tsp + 1 pinch}.").fixed).toBe(true);
	});

	it("counts as one entry of the shopping list, which --target accepts", () => {
		const compiled = recipe("@flour{1 cup + 1 tbsp}.");
		expect(compiled.shopping_list).toMatchObject([
			{ id: "flour", qty: 17, unit: "tbsp" },
		]);
		expect(
			resolveScaleFactor(compiled, {
				type: "target",
				id: "flour",
				qty: 34,
				unit: "tbsp",
			}).factor,
		).toBe(2);
	});
});

describe("a sum of several families", () => {
	it("keeps its text in unit, with no qty", () => {
		const usage = first("@flour{1 cup + 1,5 g}.");
		expect(usage.qty).toBeUndefined();
		expect(usage.unit).toBe("1 cup + 1.5 g");
		expect(usage.parts).toHaveLength(2);
	});

	it("is bought exactly as its terms written apart", () => {
		expect(shopping("@flour{1 cup + 20 g} and @flour{50 g}.")).toEqual(
			shopping("@flour{1 cup} and @flour{20 g} and @flour{50 g}."),
		);
	});

	it("adds up each family on its own", () => {
		expect(
			recipe("@butter{1 cup - 2 tbsp + 30 g}.").shopping_list,
		).toMatchObject([
			{ id: "butter", qty: 14, unit: "tbsp", multiUnit: true },
			{ id: "butter", qty: 30, unit: "g", multiUnit: true },
		]);
	});

	it("is refused as a --target, like two occurrences", () => {
		const compiled = recipe("@flour{1 cup + 20 g}.");
		expect(() =>
			resolveScaleFactor(compiled, { type: "target", id: "flour", qty: 2 }),
		).toThrow(AmbiguousMultiUnitError);
	});

	it("scales term by term, its text written again", () => {
		const scaled = applyScale(recipe("@flour{1 cup + 20 g}."), 2);
		expect(scaled.sections[0]?.ingredients[0]).toMatchObject({
			unit: "2 cup + 40 g",
			parts: [
				{ qty: 2, unit: "cup" },
				{ qty: 40, unit: "g" },
			],
		});
	});
});

describe("refused sums (INVALID_QUANTITY)", () => {
	const cases: [string, string, string][] = [
		["percentTerm", "@flour{100 g + 10%}.", "10%"],
		["expressionTerm", "@flour{2 x 100 g + 50 g}.", "2 x 100 g"],
		["unitlessTerm", "@flour{1 + 1 cup}.", "1"],
		["quantityInUnit", "@tomatoes{1 tin of 400 g + 50 g}.", "1 tin of 400 g"],
		["nonPositiveTotal", "@butter{1 tbsp - 1 cup}.", "1 tbsp - 1 cup"],
		["rangeAfterMinus", "@cream{1 cup - 1-2 tbsp}.", "1-2 tbsp"],
		["minusAcrossFamilies", "@oil{1 cup - 20 g}.", "1 cup - 20 g"],
	];

	for (const [reason, body, value] of cases) {
		it(`refuses ${reason}, pointing at "${value}"`, () => {
			const source = `## Section\n\n${body}\n`;
			const [warning] = compile(getAST(source)).warnings.filter(
				(w) => w.code === WarningCode.INVALID_QUANTITY,
			);
			expect(warning?.data?.reason).toBe(reason);
			const loc = warning?.loc;
			expect(loc && source.slice(loc.start, loc.end)).toBe(value);
		});

		it(`keeps the parts of a ${reason} sum and counts it for nothing`, () => {
			const usage = first(body);
			expect(usage.parts?.length).toBeGreaterThan(1);
			expect(usage.qty).toBeUndefined();
			expect(usage.unit).toBeUndefined();
			const [entry] = recipe(body).shopping_list;
			expect(entry).not.toHaveProperty("qty");
		});
	}

	it("warns of a term with no unit before the sum falls back to text", () => {
		// `{1 + 1 cup}` adds up to nothing (`termsTotal` is null): without the
		// warning it would pass silently as a sum of several families.
		expect(first("@milk{1 + 1 cup}.").unit).toBeUndefined();
		expect(warnings("@milk{1 + 1 cup}.", "INVALID_QUANTITY")).toHaveLength(1);
	});

	it("suggests the result of a percentage, carried in data", () => {
		const [warning] = warnings("@flour{100 g + 10%}.", "INVALID_QUANTITY");
		expect(warning?.data).toEqual({
			reason: "percentTerm",
			suggestion: "110 g",
		});
		expect(warning?.message).toContain("{110 g}");
	});

	it("is a warning, not an error", () => {
		expect(warningSeverity[WarningCode.INVALID_QUANTITY]).toBe("warning");
	});
});

describe("notes on a sum Gram reads", () => {
	it("tells that oz after a volume is a weight (info)", () => {
		const source = "## Section\n\n@water{1 cup + 2 oz}.\n";
		const [warning] = compile(getAST(source)).warnings.filter(
			(w) => w.code === WarningCode.OZ_AFTER_VOLUME,
		);
		expect(warning?.data).toEqual({ suggestion: "fl oz" });
		const loc = warning?.loc;
		expect(loc && source.slice(loc.start, loc.end)).toBe("2 oz");
		expect(warningSeverity[WarningCode.OZ_AFTER_VOLUME]).toBe("info");
		expect(first("@water{1 cup + 2 oz}.").unit).toBe("1 cup + 2 oz");
	});

	it("says nothing of fl oz, nor of oz with no volume", () => {
		expect(warnings("@water{1 cup + 2 fl oz}.", "OZ_AFTER_VOLUME")).toEqual([]);
		expect(warnings("@beef{1 lb + 2 oz}.", "OZ_AFTER_VOLUME")).toEqual([]);
	});

	it("reads each term for two quantities in one unit", () => {
		const [warning] = warnings("@beef{1 lb 4 oz + 2 oz}.", "INVALID_UNIT");
		expect(warning?.message).toContain("lb 4 oz");
		expect(warning?.data).toEqual({
			reason: "twoQuantities",
			suggestion: "lb + 4 oz",
		});
	});

	it("carries the sum to write for two quantities in one unit, outside a sum too", () => {
		const [warning] = warnings("@milk{1 cup 5 tbsp}.", "INVALID_UNIT");
		expect(warning?.data).toEqual({
			reason: "twoQuantities",
			suggestion: "cup + 5 tbsp",
		});
		const [hidden] = warnings("@flour{about 200g}.", "INVALID_UNIT");
		expect(hidden?.data).toEqual({ reason: "hiddenQuantity" });
	});

	it("reads each term for an ambiguous comma", () => {
		const found = warnings("@flour{1,000 g + 1 kg}.", "AMBIGUOUS_NUMBER");
		expect(found).toHaveLength(1);
		expect(found[0]?.message).toContain("1,000");
	});

	it("adds nothing to the warnings of a plain sum", () => {
		expect(recipe("@flour{1 cup + 1 tbsp}.").warnings).toEqual([]);
	});
});

describe("composite parents and references", () => {
	it("writes the parts of a composite parent's share", () => {
		const usage = first("@juice{100 ml}<@oranges{1 lb + 4 oz}.");
		expect(usage.composite).toMatchObject({
			quantity: 20,
			unit: "oz",
			parts: [
				{ qty: 1, unit: "lb" },
				{ qty: 4, unit: "oz" },
			],
		});
	});

	it("scales a composite parent's share term by term", () => {
		const scaled = applyScale(
			recipe("@juice{100 ml}<@oranges{1 lb + 4 oz}."),
			2,
		);
		expect(
			(scaled.sections[0]?.ingredients[0] as Usage | undefined)?.composite,
		).toMatchObject({ quantity: 40, parts: [{ qty: 2 }, { qty: 8 }] });
	});

	it("writes the parts of a reference", () => {
		const compiled = compile(
			getAST(
				"## Dough ->&dough\n\nMix @flour{1 kg}.\n\n## Bake\n\nShape &dough{1 kg + 200 g}.\n",
			),
		);
		expect(compiled.sections[1]?.ingredients[0]).toMatchObject({
			type: "reference",
			qty: 1200,
			unit: "g",
			parts: [
				{ qty: 1, unit: "kg" },
				{ qty: 200, unit: "g" },
			],
		});
	});
});

describe("sections", () => {
	it("lists a sum as written, its parts kept, a term taken away marked", () => {
		const [entry] = aggregateSectionIngredients(
			ingredients("@sugar{1 cup - 2 tbsp}."),
		);
		expect(entry?.quantities).toEqual([
			{
				qty: 14,
				unit: "tbsp",
				parts: [
					{ qty: 1, unit: "cup" },
					{ qty: 2, unit: "tbsp", minus: true },
				],
			},
		]);
	});

	it("still lists a refused sum, for the reader", () => {
		const [entry] = aggregateSectionIngredients(
			ingredients("@flour{100 g + 10%}."),
		);
		expect(entry?.quantities).toHaveLength(1);
		expect(entry?.quantities?.[0]?.parts).toHaveLength(2);
	});
});
