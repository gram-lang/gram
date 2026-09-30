import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { KITCHEN_VERSION } from "../src/version";

const RECIPE = `## Dough ->&dough

Mix @flour{500g} and @water{300ml} in a #bowl.

[Rest] Let it rest ~_{2h}.

## Filling

Slice @onions{200g}(finely sliced).

## Assembly

Combine &dough and the filling, then bake for ~{25min}.
`;

describe("compiled mise en place and schedules", () => {
	it("stamps the compiler version in `generator`", () => {
		const result = compile(getAST(RECIPE));
		expect(result.generator).toBe(`@gram-lang/kitchen@${KITCHEN_VERSION}`);
		expect(KITCHEN_VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("does not scale durations: mise en place and schedules ignore the scale factor", () => {
		const base = compile(getAST(RECIPE));
		const scaled = compile(getAST(RECIPE), { scaleFactor: 3 });

		expect(scaled.miseEnPlace).toEqual(base.miseEnPlace);
		expect(scaled.schedules).toEqual(base.schedules);
		expect(scaled.metrics.preparationTime).toBe(base.metrics.preparationTime);
	});

	it("keeps `miseEnPlace` and the schedules present, and empty, for an empty recipe", () => {
		const result = compile(getAST(""));
		expect(result.miseEnPlace).toEqual([]);
		expect(result.schedules.perSection.blocks).toEqual([]);
		expect(result.schedules.upfront.blocks).toEqual([]);
		expect(result.schedules.perSection.totalTime).toBe(0);
	});

	it("keeps the deprecated fields' values and meaning", () => {
		const result = compile(getAST(RECIPE));
		// The legacy total is the upfront timeline's total.
		expect(result.metrics.totalTime).toBe(result.schedules.upfront.totalTime);
		expect(result.metrics.preparationTime).toBe(
			result.miseEnPlace.reduce((sum, m) => sum + m.duration, 0),
		);
	});
});

describe("an intermediate is fetched where it is used", () => {
	const SOURCE = `## Dough ->&dough

Mix @flour{500g} and @water{300ml}.

## Filling ->&filling

Cook @onions{200g}(finely sliced).

## Assembly

Spread &filling{100g} over &dough{200g}.
`;

	const gathered = (result: ReturnType<typeof compile>, section: number) =>
		result.miseEnPlace
			.find((m) => m.section === section)
			?.items.flatMap((i) =>
				i.kind === "gather" && i.target === "ingredient" ? [i.count] : [],
			)
			.reduce((a, b) => a + b, 0) ?? 0;

	it("charges the section that uses it, not the one that makes it", () => {
		const result = compile(getAST(SOURCE));
		expect(gathered(result, 0)).toBe(2); // flour, water
		expect(gathered(result, 1)).toBe(1); // onions
		expect(gathered(result, 2)).toBe(2); // &filling, &dough
	});

	it("keeps the total the same wherever the intermediates are charged", () => {
		expect(compile(getAST(SOURCE)).metrics.preparationTime).toBe(7);
	});

	it("keeps an intermediate nobody reuses with the section that makes it", () => {
		const result = compile(
			getAST(
				"## Dough ->&dough\n\nMix @flour{500g}.\n\n## Bake\n\nBake for ~{20min}.\n",
			),
		);
		expect(gathered(result, 0)).toBe(2); // flour, &dough
		expect(result.metrics.preparationTime).toBe(2);
	});

	it("does not charge the section that makes it, even if it mentions it again", () => {
		const result = compile(
			getAST(
				"## Dough ->&dough\n\nMix @flour{500g}.\n\nShape the &dough{200g}.\n\n## Bake\n\nBake &dough for ~{20min}.\n",
			),
		);
		expect(gathered(result, 0)).toBe(1); // flour
		expect(gathered(result, 1)).toBe(1); // &dough
	});

	describe("sections without a step", () => {
		const consistent = (result: ReturnType<typeof compile>) => {
			for (const key of ["perSection", "upfront"] as const) {
				const s = result.schedules[key];
				expect(s.idleTime).toBeGreaterThanOrEqual(0);
				const prep = s.blocks
					.filter((b) => b.kind === "prep")
					.reduce((sum, b) => sum + b.end - b.start, 0);
				expect(prep).toBe(result.metrics.preparationTime);
			}
		};

		it("never charges a section that has no step (typing `## Dough ->&dough` before its steps)", () => {
			const result = compile(
				getAST(
					"## Pate ->&pate\n\n// todo\n\n## Cuisson\n\nCuire @riz{200g}.\n",
				),
			);
			expect(result.miseEnPlace.map((m) => m.section)).toEqual([1]);
			consistent(result);
		});

		it("has no mise en place at all when nothing has a step", () => {
			for (const src of [
				'@use "./sauce.gram" as &sauce\n\n// todo\n',
				'@use "./sauce.gram" as &sauce\n',
			]) {
				const result = compile(getAST(src));
				expect(result.miseEnPlace).toEqual([]);
				expect(result.metrics.preparationTime).toBe(0);
				consistent(result);
			}
		});
	});

	it("raises a time paradox once, whichever timeline finds it", () => {
		const result = compile(
			getAST(
				"## Base ~{-1min} ->&base\n\nMix @flour{100g}.\n\n## Finish\n\nAdd &base and @salt{1g}.\n\n## Serve\n\nServe with @parsley{1}.\n",
			),
		);
		expect(
			result.warnings.filter((w) => w.code === "TIME_PARADOX"),
		).toHaveLength(1);
	});

	it("weighs an intermediate where it is used, however it is declared", () => {
		const perSection = (src: string) =>
			compile(getAST(src)).miseEnPlace.map((m) => [m.section, m.duration]);
		const onSection = perSection(
			"## A ->&dough\n\nMix @flour{100g}.\n\n## B\n\nBake &dough.\n",
		);
		const onStep = perSection(
			"## A\n\nMix @flour{100g}. ->&dough\n\n## B\n\nBake &dough.\n",
		);
		expect(onSection).toEqual([
			[0, 1],
			[1, 1],
		]);
		expect(onStep).toEqual(onSection);
	});
});
