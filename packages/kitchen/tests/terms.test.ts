import { describe, it, expect } from "bun:test";
import { ASTNodeType, getAST, type IngredientAST } from "@gram-lang/parser";
import {
	numericTotal,
	scaleUsageTerms,
	termsOfAst,
	termsOfUsage,
	usageFromTerms,
	writeSum,
	familyTotals,
} from "../src/terms";
import { InvalidFactorError } from "../src/scale/types";

describe("termsOfUsage", () => {
	it("reads one term from a number, a single, a fraction or a range", () => {
		expect(termsOfUsage({ qty: 200, unit: "g" })).toEqual([
			{ value: 200, unit: "g" },
		]);
		const range = {
			type: "range" as const,
			value: 2.5,
			range: { min: 2, max: 3 },
		};
		expect(termsOfUsage({ qty: range })).toEqual([
			{ value: range, unit: null },
		]);
	});

	it("reads no term from a text, a relative quantity or no quantity", () => {
		expect(termsOfUsage({ qty: "une pincée" })).toEqual([]);
		expect(
			termsOfUsage({
				qty: {
					type: ASTNodeType.RelativeQuantity,
					percent: 10,
					target: "farine",
					referenceType: "ingredient",
				},
			}),
		).toEqual([]);
		expect(termsOfUsage({})).toEqual([]);
		expect(termsOfUsage(null)).toEqual([]);
	});
});

describe("termsOfAst", () => {
	it("reads a quantity node like a usage, keeping the AST shape", () => {
		const ast = getAST("Mix @flour{1/2 cup}.\n");
		const step = ast.children[0];
		if (step?.type !== ASTNodeType.Step) throw new Error("no step");
		const ing = step.children.find(
			(c): c is IngredientAST => c.type === ASTNodeType.Ingredient,
		);
		const [term] = termsOfAst(ing?.quantity);
		expect(term?.unit).toBe("cup");
		expect(term?.value).toMatchObject({ type: "fraction", value: 0.5 });
	});

	it("reads one term per term of a sum, its sign kept", () => {
		const ast = getAST("Mix @flour{1 cup - 1-2 tbsp + 1/0 tsp}.\n");
		const step = ast.children[0];
		if (step?.type !== ASTNodeType.Step) throw new Error("no step");
		const ing = step.children.find(
			(c): c is IngredientAST => c.type === ASTNodeType.Ingredient,
		);
		const terms = termsOfAst(ing?.quantity);
		// `1/0 tsp` has no value: left out, as a quantity with none is.
		expect(terms).toHaveLength(2);
		expect(terms[0]).toMatchObject({ unit: "cup", value: { value: 1 } });
		expect(terms[0]?.minus).toBeUndefined();
		expect(terms[1]).toMatchObject({
			unit: "tbsp",
			minus: true,
			value: { type: "range", range: { min: 1, max: 2 } },
		});
	});

	it("reads no term from a text quantity", () => {
		expect(
			termsOfAst({
				type: ASTNodeType.TextQuantity,
				value: "a pinch",
				loc: { start: 0, end: 0 },
			}),
		).toEqual([]);
	});
});

describe("usageFromTerms", () => {
	it("writes the total back, the unit only when it changes", () => {
		const usage = { id: "flour", qty: 1, unit: "cup" };
		usageFromTerms(usage, [{ value: 2, unit: "cup" }]);
		expect(usage).toEqual({ id: "flour", qty: 2, unit: "cup" });

		const bare: { id: string; qty?: number } = { id: "eggs" };
		usageFromTerms(bare, [{ value: 3, unit: null }]);
		expect(bare).toEqual({ id: "eggs", qty: 3 });
	});

	it("leaves the usage alone when the terms have no single total", () => {
		const usage = { id: "flour", qty: 1, unit: "cup" };
		usageFromTerms(usage, [
			{ value: 1, unit: "cup" },
			{ value: 20, unit: "g" },
		]);
		expect(usage).toEqual({ id: "flour", qty: 1, unit: "cup" });
	});
});

describe("numericTotal and scaleUsageTerms", () => {
	it("reads the middle of a range", () => {
		expect(
			numericTotal(
				termsOfUsage({
					qty: { type: "range", value: 2.5, range: { min: 2, max: 3 } },
				}),
			),
		).toBe(2.5);
	});

	it("has nothing to scale without a term", () => {
		expect(scaleUsageTerms([], 2)).toBeNull();
	});

	it("reports an overflow as the scaler's InvalidFactorError", () => {
		expect(() => scaleUsageTerms([{ value: 500, unit: "g" }], 1e308)).toThrow(
			InvalidFactorError,
		);
	});
});

describe("parts", () => {
	const parts = [
		{ qty: 1, unit: "cup" },
		{ qty: 2, unit: "tbsp", minus: true as const },
	];

	it("are read before qty / unit", () => {
		expect(termsOfUsage({ qty: 14, unit: "tbsp", parts })).toEqual([
			{ value: 1, unit: "cup" },
			{ value: 2, unit: "tbsp", minus: true },
		]);
	});

	it("never take the text of several families for a unit", () => {
		const usage = {
			unit: "1 cup + 20 g",
			parts: [parts[0]!, { qty: 20, unit: "g" }],
		};
		expect(termsOfUsage(usage).map((t) => t.unit)).toEqual(["cup", "g"]);
	});

	it("of a refused sum count for nothing", () => {
		expect(termsOfUsage({ parts })).toEqual([]);
	});

	it("are written with what they amount to", () => {
		const usage = writeSum({ id: "sugar" }, termsOfUsage({ parts, unit: "x" }));
		expect(usage).toEqual({ id: "sugar", qty: 14, unit: "tbsp", parts });
		expect(writeSum({}, termsOfUsage({ parts, unit: "x" }), true)).toEqual({
			parts,
		});
	});

	it("add up one family at a time", () => {
		expect(
			familyTotals([
				{ value: 1, unit: "kg" },
				{ value: 200, unit: "g" },
				{ value: 1, unit: "cup" },
			]),
		).toEqual([
			{ value: 1200, unit: "g" },
			{ value: 1, unit: "cup" },
		]);
	});
});
