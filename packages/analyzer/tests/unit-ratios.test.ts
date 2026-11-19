import { describe, expect, it } from "bun:test";
import {
	type CompilationResult,
	compile,
	type ProcessedTimer,
	WarningCode,
} from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { analyze, diffRecipes } from "../src/index";
import type { AnalyzedUsage, IngredientData } from "../src/types";

// Ratios with units that kitchen leaves waiting (a density, a unit weight,
// a target that is itself a share, an intermediate used whole) are resolved
// by the analyzer, through the same `resolveRatios` with its converter.
const database: Record<string, IngredientData> = {
	flour: { name: "Flour", physical: { density: 0.55 } },
	milk: { name: "Milk", physical: { density: 1 } },
	eggs: { name: "Eggs", physical: { density: 1, unit_weight: 50 } },
	cutlet: { name: "Cutlet", physical: { density: 1, unit_weight: 200 } },
	salt: { name: "Salt", physical: { density: 1.2 } },
	garlic: { name: "Garlic", physical: { density: 1, unit_weight: 5 } },
};

const compiled = (source: string) => compile(getAST(source));
const run = (source: string) => analyze(compiled(source), database).result;
const prep = (body: string) => run(`## Prep\n\n${body}\n`);

function usage(
	result: { sections: { ingredients: AnalyzedUsage[] }[] },
	id: string,
	nth = 0,
) {
	const all = result.sections.flatMap((s) =>
		s.ingredients.filter((i) => i.id === id),
	);
	const found = all[nth];
	if (!found) throw new Error(`no usage ${id}`);
	return found;
}

const timers = (result: Pick<CompilationResult, "sections">) =>
	result.sections.flatMap((sec) =>
		sec.steps.flatMap((step) =>
			step.type === "step"
				? step.content.filter(
						(t): t is ProcessedTimer =>
							typeof t === "object" && "type" in t && t.type === "timer",
					)
				: [],
		),
	);

const ratioWarnings = (result: CompilationResult) =>
	result.warnings.filter(
		(w) => w.code === WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS,
	);

describe("ratios resolved with the database", () => {
	it("crosses mass and volume with a density", () => {
		const result = prep("Mix @flour{200 g} and @eggs{1 / 50 ml @&flour}.");
		const eggs = usage(result, "eggs");
		expect(eggs.qty).toEqual({ type: "single", value: 7.27 });
		expect(eggs.normalizedMass).toBe(363.5);
		expect(eggs.isEstimate).toBe(true);
	});

	it("counts pieces with a unit weight", () => {
		const result = prep("Fry @cutlet{800 g} with @salt{1 g / @&cutlet}.");
		expect(usage(result, "salt")).toMatchObject({
			qty: { type: "single", value: 4 },
			unit: "g",
			normalizedMass: 4,
		});
	});

	it("takes the recipe's own density as exact", () => {
		const result = run(
			"---\ndensities: [flour:0.5]\n---\n\n## Prep\n\nMix @flour{200 g} and @eggs{1 / 100 ml @&flour}.\n",
		);
		expect(usage(result, "eggs").qty).toEqual({ type: "single", value: 4 });
	});

	it("says what is missing, pointing at the ratio", () => {
		const source = "## Prep\n\nMix @sugar{200 g} and @x{1 / 100 ml @&sugar}.\n";
		const result = analyze(compiled(source), database).result;
		const [warning] = ratioWarnings(result);
		expect(warning?.message).toContain("density is unknown");
		expect(source.slice(warning?.loc?.start, warning?.loc?.end)).toBe(
			"1 / 100 ml @&sugar",
		);
		expect(
			ratioWarnings(prep("Mix @sugar{200 g} and @x{1 / @&sugar}."))[0]?.message,
		).toContain("unit_weight");
	});

	it("refuses a named piece against a weight, which only it can tell", () => {
		const result = prep("Mix @sugar{100 g} and @x{1 / 2 slices @&sugar}.");
		expect(ratioWarnings(result)).toHaveLength(1);
		expect(ratioWarnings(result)[0]?.message).toContain(
			"do not measure the same thing",
		);
	});

	it("never says twice what kitchen already refused", () => {
		const result = prep("Mix @garlic{3 cloves} and @x{1 / 2 slices @&garlic}.");
		expect(ratioWarnings(result)).toHaveLength(1);
	});

	it("gives the same mass as the equivalent share", () => {
		const share = prep("Mix @flour{250 g} and @salt{2% @&flour}.");
		const ratio = prep("Mix @flour{250 g} and @salt{2 g / 100 g @&flour}.");
		expect(usage(ratio, "salt").normalizedMass).toBe(
			usage(share, "salt").normalizedMass as number,
		);
	});
});

describe("shares and ratios in the order of their dependencies", () => {
	it("resolves a ratio of a share", () => {
		const result = prep(
			"Mix @flour{200 g}, @water{70% @&flour} and @salt{2 g / 100 g @&water}.",
		);
		expect(usage(result, "salt").qty).toEqual({ type: "single", value: 2.8 });
		expect(usage(result, "salt").isEstimate).toBeFalsy();
	});

	it("resolves a share of a ratio kitchen left waiting", () => {
		const result = prep(
			"Mix @flour{200 g}, @milk{1 g / 1 ml @&flour} and @salt{1% @&milk}.",
		);
		expect(usage(result, "milk").normalizedMass).toBeCloseTo(363.64, 1);
		expect(usage(result, "salt").normalizedMass).toBeCloseTo(3.64, 1);
		expect(ratioWarnings(result)).toEqual([]);
	});
});

describe("an intermediate used whole", () => {
	const dough = `## Dough ->&dough

Mix @flour{500 g} and @water{60% @&flour}.

## Bake

`;

	it("weighs the section that makes it, for a ratio, a share and a timer", () => {
		const result = run(
			`${dough}Roll out the &dough, add @salt{2 g / 100 g &dough} and @sugar{1% &dough}, bake ~{30 min / 1 kg &dough}.\n`,
		);
		expect(usage(result, "salt")).toMatchObject({
			qty: { type: "single", value: 16 },
			isEstimate: true,
		});
		expect(usage(result, "sugar")).toMatchObject({
			normalizedMass: 8,
			isEstimate: true,
		});
		expect(timers(result)[0]?.minutes).toBe(24);
		// The reference itself gets no mass: the sections weigh as before.
		expect(usage(result, "dough").normalizedMass).toBeUndefined();
		expect(result.sections[0]?.metrics?.totalMass).toBe(800);
	});

	it("is refused when another section uses it too", () => {
		const result = run(
			`${dough}Roll out the &dough, add @salt{2 g / 100 g &dough}.\n\n## Serve\n\nCut the &dough.\n`,
		);
		expect(ratioWarnings(result)[0]?.message).toContain(
			"used whole in several sections",
		);
	});

	it("is refused when the mass of the section that makes it is incomplete", () => {
		const result = run(
			"## Dough ->&dough\n\nMix @flour{500 g} and @sugar{1 cup}.\n\n## Bake\n\nRoll out the &dough, add @salt{2 g / 100 g &dough}.\n",
		);
		expect(ratioWarnings(result)[0]?.message).toContain(
			"mass of the section that makes it is unknown",
		);
	});

	it("says a step makes it, for a ratio, a share and a timer", () => {
		const result = run(
			"## Dough\n\nMix @flour{500 g} and @water{300 g}. ->&dough\n\n## Bake\n\nRoll out the &dough, add @salt{2 g / 100 g &dough} and @sugar{1% &dough}, bake ~{30 min / 1 kg &dough}.\n",
		);
		const said = result.warnings.filter(
			(w) => w.code === WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS,
		);
		expect(said.map((w) => w.item).sort()).toEqual(["Timer", "salt", "sugar"]);
		for (const warning of said) {
			expect(warning.message).toContain(
				"'&dough' is made by a step, not by a whole section",
			);
		}
	});
});

describe("the schedule of a proportional time resolved here", () => {
	const source =
		"## Prep\n\nFry @cutlet{800 g} ~_{4 min / @&cutlet}.\n\nServe.\n";

	it("gets its timer task, and its step loses the default 2 minutes", () => {
		const before = compiled(source);
		expect(before.tasks.tasks.some((t) => t.kind === "passive")).toBe(false);
		const { result } = analyze(before, database);
		expect(timers(result)[0]?.minutes).toBe(16);
		expect(result.tasks.tasks).toContainEqual(
			expect.objectContaining({ kind: "passive", duration: { nominal: 16 } }),
		);
		const step = result.sections[0]?.steps[0];
		expect(step?.type === "step" && step.timings.activeDuration).toBe(0);
		expect(result.schedule.totalTime).toBeGreaterThan(
			before.schedule.totalTime,
		);
		expect(result.metrics.totalTime).toBeGreaterThan(before.metrics.totalTime);
	});

	it("is the same analyzed twice, and leaves the compiled result untouched", () => {
		const base = compiled(source);
		const snapshot = structuredClone(base);
		const first = analyze(base, database).result;
		const second = analyze(base, database).result;
		expect(second).toEqual(first);
		expect(base).toEqual(snapshot);
		const step = second.sections[0]?.steps[0];
		expect(step?.type === "step" && step.backgroundTasks).toHaveLength(1);
	});
});

describe("the shopping list of resolved ratios", () => {
	it("gives a ratio resolved here its amount and unit", () => {
		const result = prep("Mix @flour{200 g} and @eggs{1 / 50 ml @&flour}.");
		expect(result.shopping_list).toContainEqual(
			expect.objectContaining({ id: "eggs", qty: 7.27 }),
		);
		const eggs = result.shopping_list.find((i) => i.id === "eggs");
		expect(eggs?.variable_entries ?? []).toEqual([]);
	});

	it("keeps a quantity in words next to a share or a ratio", () => {
		const share = prep(
			"Mix @flour{250 g}, @salt{2% @&flour} and @salt{a pinch}.",
		);
		const ratio = prep(
			"Mix @flour{200 g}, @salt{1 g / 50 ml @&flour} and @salt{a pinch}.",
		);
		for (const result of [share, ratio]) {
			const entries = result.shopping_list.filter((i) => i.id === "salt");
			expect(entries.flatMap((e) => e.variable_entries ?? [])).toContain(
				"a pinch",
			);
		}
	});
});

describe("ratios elsewhere in the analyzer", () => {
	it("never takes a ratio as the baker's base", () => {
		const result = prep("Mix @flour{200 g} and @*water{70 g / 100 g @&flour}.");
		expect(result.warnings.map((w) => w.code)).toContain(
			WarningCode.INVALID_BAKERS_REFERENCE,
		);
	});

	it("shows a changed proportional time in a diff", () => {
		const a = compiled(
			"## Roast\n\nRoast @roast{1 kg} ~{15 min / 500 g @&roast}.\n",
		);
		const b = compiled(
			"## Roast\n\nRoast @roast{1 kg} ~{20 min / 500 g @&roast}.\n",
		);
		expect(diffRecipes(a, b).timers).toEqual([
			expect.objectContaining({
				change: "changed",
				from: "15 min / 500 g @&roast (30 min)",
				to: "20 min / 500 g @&roast (40 min)",
			}),
		]);
	});
});
