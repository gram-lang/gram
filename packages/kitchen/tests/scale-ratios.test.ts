import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	applyScale,
	type CompilationResult,
	compile,
	type ProcessedTimer,
	scaleAst,
} from "../src/index";

// Scaling a recipe with ratios resolves them again on the scaled targets,
// builds the shopping list again and, when a proportional time changes,
// lays the schedule out again: the scaled recipe is the one `scaleAst`
// writes, compiled.
const source = `## Roast ->&roast

Season @roast{1 kg} with @salt{15 g / 1 kg @&roast}, @=pepper{2 g} and @x{1 / 1 g @&pepper}.

Roast ~{15 min / 500 g @&roast}, then rest ~_rest{10 min}.

## Sauce

Reduce @stock{500 ml} ~_{1 min / 50 ml @&stock} with @salt{2 g}.
`;

const timerMinutes = (result: CompilationResult) =>
	result.sections.flatMap((sec) =>
		sec.steps.flatMap((step) =>
			step.type === "step"
				? step.content
						.filter(
							(t): t is ProcessedTimer =>
								typeof t === "object" && "type" in t && t.type === "timer",
						)
						.map((t) => t.minutes)
				: [],
		),
	);

const legacy = (result: CompilationResult) =>
	result.sections.map((sec) =>
		sec.steps.map((step) =>
			step.type === "step" ? [step.timings, step.backgroundTasks] : null,
		),
	);

describe("applyScale on a recipe with ratios", () => {
	const ast = getAST(source);
	const compiled = compile(ast);

	for (const factor of [2, 0.5, 3]) {
		it(`is the rewritten source, compiled (×${factor})`, () => {
			const scaled = applyScale(compiled, factor);
			const rewritten = compile(scaleAst(ast, factor));
			expect(scaled.schedule).toEqual(rewritten.schedule);
			expect(scaled.tasks).toEqual(rewritten.tasks);
			expect(scaled.metrics).toEqual(rewritten.metrics);
			expect(legacy(scaled)).toEqual(legacy(rewritten));
			expect(scaled.shopping_list).toEqual(rewritten.shopping_list);
		});
	}

	it("doubles a proportional time with its target, keeps a fixed one", () => {
		expect(timerMinutes(compiled)).toEqual([30, 10, 10]);
		expect(timerMinutes(applyScale(compiled, 2))).toEqual([60, 10, 20]);
	});

	it("keeps a ratio whose target is `@=`", () => {
		const shopping = applyScale(compiled, 2).shopping_list;
		expect(shopping).toContainEqual(
			expect.objectContaining({ id: "x", qty: 2 }),
		);
		expect(shopping).toContainEqual(
			expect.objectContaining({ id: "salt", qty: 34, unit: "g" }),
		);
	});

	it("never accumulates: scaling twice is scaling once by the product", () => {
		const twice = applyScale(applyScale(compiled, 2), 1.5);
		const once = applyScale(compiled, 3);
		expect(twice.schedule).toEqual(once.schedule);
		expect(twice.metrics).toEqual(once.metrics);
		expect(twice.shopping_list).toEqual(once.shopping_list);
		expect(legacy(twice)).toEqual(legacy(once));
	});

	it("does nothing at factor 1, and never touches the compiled result", () => {
		const before = structuredClone(compiled);
		expect(applyScale(compiled, 1)).toBe(compiled);
		applyScale(compiled, 2);
		expect(compiled).toEqual(before);
	});

	it("goes through compile's own scale factor the same way", () => {
		const viaOption = compile(ast, { scaleFactor: 2 });
		expect(viaOption.schedule).toEqual(compile(scaleAst(ast, 2)).schedule);
	});

	it("leaves a ratio waiting for the analyzer as it is", () => {
		const result = applyScale(
			compile(getAST("Mix @flour{250 g} and @milk{1 / 100 ml @&flour}.\n")),
			2,
		);
		expect(result.sections[0]?.ingredients[1]?.qty).toMatchObject({
			type: "RatioQuantity",
		});
	});
});

describe("scaleAst and ratios", () => {
	it("leaves a ratio and a proportional time as written", () => {
		const ast = getAST(source);
		const scaled = scaleAst(ast, 2);
		const ratios = (tree: typeof ast) =>
			JSON.stringify(tree).match(/"type":"RatioQuantity"[^}]*}/g);
		expect(ratios(scaled)).toEqual(ratios(ast));
	});
});
