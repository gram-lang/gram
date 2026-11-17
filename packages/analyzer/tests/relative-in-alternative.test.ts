import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile, WarningCode } from "@gram-lang/kitchen";
import { analyze } from "../src/index";
import type { IngredientData } from "../src/types";

// A percentage inside an alternative (`@butter{10% @&flour}|@oil{8% @&flour}`)
// used to stay unresolved, with no warning: pass 1.5 only walked the
// section's own ingredients and never went down into an alternative's
// options. Each option is now resolved for itself, never added to the others.
const database: Record<string, IngredientData> = {
	flour: { name: "Flour", physical: { density: 0.55 } },
	butter: { name: "Butter", physical: { density: 0.91 } },
	oil: { name: "Oil", physical: { density: 0.92 } },
};

function run(body: string) {
	const compiled = compile(getAST(`## Dough\n\n${body}\n`));
	return { compiled, ...analyze(compiled, database) };
}

function optionsOf(items: any[]) {
	const alt = items.find((item) => item.type === "alternative");
	return alt.options.map((opt: any) => ({
		id: opt.id,
		qty: opt.qty,
		unit: opt.unit,
		normalizedMass: opt.normalizedMass,
		conversionMethod: opt.conversionMethod,
	}));
}

const twenty = {
	qty: { type: "single", value: 20 },
	unit: "g",
	normalizedMass: 20,
	conversionMethod: "relative",
};

describe("relative quantities inside an alternative", () => {
	it("resolves each option against the section's ingredients", () => {
		const { result } = run(
			"Mix @flour{200 g} and @butter{10% @&flour}|@oil{8% @&flour}.",
		);

		const expected = [
			{ id: "butter", ...twenty },
			{
				id: "oil",
				qty: { type: "single", value: 16 },
				unit: "g",
				normalizedMass: 16,
				conversionMethod: "relative",
			},
		];
		expect(optionsOf(result.sections[0]!.ingredients)).toEqual(expected);
		expect(optionsOf(result.shopping_list)).toEqual(expected);

		const step = result.sections[0]!.steps[0] as any;
		expect(optionsOf(step.content)).toEqual(expected);
		expect(
			result.warnings.some(
				(w) => w.code === WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS,
			),
		).toBe(false);
	});

	it("never adds the options together in the mass totals", () => {
		const { result } = run(
			"Mix @flour{200 g} and @butter{10% @&flour}|@oil{8% @&flour}.",
		);

		// The first option stands for the group, as for any alternative.
		expect(result.metrics.totalMass).toBe(220);
		expect(result.metrics.massStatus).toBe("precise");
	});

	it("takes a share of an earlier option of the same group", () => {
		const { result } = run(
			"Mix @flour{200 g} and @butter{100 g}|@oil{80% @&butter}.",
		);

		const [, oil] = optionsOf(result.shopping_list);
		expect(oil.normalizedMass).toBe(80);
		expect(oil.conversionMethod).toBe("relative");
	});

	it("follows a chain of options", () => {
		const { result } = run(
			"Mix @flour{200 g} and @butter{10% @&flour}|@oil{80% @&butter}.",
		);

		const [butter, oil] = optionsOf(result.sections[0]!.ingredients);
		expect(butter.normalizedMass).toBe(20);
		expect(oil.normalizedMass).toBe(16);
	});

	it("refuses an option that targets a later option", () => {
		const { compiled, result } = run(
			"Mix @flour{200 g} and @butter{10% @&oil}|@oil{8% @&flour}.",
		);

		expect(compiled.warnings.map((w) => w.code)).toContain(
			WarningCode.RELATIVE_QUANTITY_UNRESOLVED,
		);
		const [butter, oil] = optionsOf(result.sections[0]!.ingredients);
		expect(butter.normalizedMass).toBeUndefined();
		expect(oil.normalizedMass).toBe(16);
		expect(
			result.warnings.filter(
				(w) => w.code === WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS,
			),
		).toHaveLength(1);
	});

	it("leaves the compiled result untouched", () => {
		const { compiled } = run(
			"Mix @flour{200 g} and @butter{10% @&flour}|@oil{8% @&flour}.",
		);
		const before = structuredClone(compiled);
		analyze(compiled, database);
		expect(compiled).toEqual(before);
	});
});
