import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	scheduleFor,
	calculatePreparationTime,
	compile,
	computeMiseEnPlace,
	type Registry,
} from "../src/index";
import { KITCHEN_VERSION } from "../src/version";

// The three timelines of a compiled recipe, laid out from its task graph.
const schedulesOf = (c: Parameters<typeof scheduleFor>[0]) => ({
	perSection: scheduleFor(c, "perSection")!,
	upfront: scheduleFor(c, "upfront")!,
	perSession: scheduleFor(c, "perSession")!,
});

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
		expect(schedulesOf(scaled)).toEqual(schedulesOf(base));
		expect(scaled.metrics.preparationTime).toBe(base.metrics.preparationTime);
	});

	it("keeps `miseEnPlace` and the schedules present, and empty, for an empty recipe", () => {
		const result = compile(getAST(""));
		expect(result.miseEnPlace).toEqual([]);
		expect(schedulesOf(result).perSection.blocks).toEqual([]);
		expect(schedulesOf(result).upfront.blocks).toEqual([]);
		expect(schedulesOf(result).perSection.totalTime).toBe(0);
	});

	it("keeps the deprecated fields' values and meaning", () => {
		const result = compile(getAST(RECIPE));
		// The legacy total is every preparation first. The upfront timeline can
		// be shorter, as it gathers an intermediate once it exists.
		expect(schedulesOf(result).upfront.totalTime).toBeLessThanOrEqual(
			result.metrics.totalTime,
		);
		const plain = compile(
			getAST("## Bake\n\nBake @flour{500g} for ~{20min}.\n"),
		);
		expect(plain.metrics.totalTime).toBe(schedulesOf(plain).upfront.totalTime);
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

	it("says how many of the gathered ingredients are intermediates", () => {
		const gather = (section: number) =>
			compile(getAST(SOURCE))
				.miseEnPlace.find((m) => m.section === section)
				?.items.find((i) => i.kind === "gather" && i.target === "ingredient");
		expect(gather(2)).toMatchObject({ count: 2, intermediates: 2 });
		// Nothing to say when there is none: the field is left out.
		expect(gather(0)).not.toHaveProperty("intermediates");
	});

	it("never plans an intermediate's preparation before the section making it", () => {
		const { upfront } = schedulesOf(compile(getAST(SOURCE)));
		const preps = upfront.blocks.filter((b) => b.kind === "prep");
		const lastStepOf = (section: number) =>
			Math.max(
				...upfront.blocks
					.filter((b) => b.kind === "step" && b.section === section)
					.map((b) => b.end),
			);

		// What can be gathered now: flour and water, then onions (and slicing them).
		const head = preps.filter((b) => b.section < 2);
		expect(head.map((b) => [b.start, b.end])).toEqual([
			[0, 2],
			[2, 5],
		]);
		// &filling and &dough wait until both are made.
		const later = preps.filter((b) => b.section === 2);
		expect(later).toHaveLength(1);
		expect(later[0]?.start).toBeGreaterThanOrEqual(
			Math.max(lastStepOf(0), lastStepOf(1)),
		);
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
				const s = schedulesOf(result)[key];
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

	describe("names shared between kinds of usage", () => {
		const mise = (src: string) => compile(getAST(src)).miseEnPlace;
		const gather = (
			entries: ReturnType<typeof mise>,
			section: number,
			target: "ingredient" | "cookware",
		) =>
			entries
				.find((m) => m.section === section)
				?.items.find((i) => i.kind === "gather" && i.target === target);

		it("does not let a piece of cookware own an ingredient of the same name", () => {
			const entries = mise(
				"## A\n\nGrease the #moule.\n\n## B\n\nAdd @moule{1}.\n",
			);
			expect(gather(entries, 0, "cookware")).toMatchObject({ count: 1 });
			expect(gather(entries, 0, "ingredient")).toBeUndefined();
			expect(gather(entries, 1, "ingredient")).toMatchObject({ count: 1 });
		});

		it("labels a preparation by what it sits on, and keeps the two apart", () => {
			const [entry] = mise(
				"## A\n\nGrease the #moule{}(buttered) and add @moule{1}(sifted).\n",
			);
			const prepared = (entry?.items ?? [])
				.flatMap((i) => (i.kind === "prepare" ? [i.ref.type] : []))
				.sort();
			expect(prepared).toEqual(["cookware", "ingredient"]);
		});

		it("does not read the group of an alternative as an ingredient called `alternative`", () => {
			const entries = mise(
				"## A\n\nUse @butter{1}|@oil{1}.\n\n## B\n\nAdd @alternative{1}.\n",
			);
			expect(gather(entries, 0, "ingredient")).toMatchObject({ count: 2 });
			expect(gather(entries, 1, "ingredient")).toMatchObject({ count: 1 });
		});
	});

	describe("public derivation (computeMiseEnPlace)", () => {
		// What a consumer holding only a compiled recipe can rebuild.
		const registryOf = (result: ReturnType<typeof compile>): Registry => ({
			ingredients: new Map(Object.entries(result.registry.ingredients)),
			cookware: new Map(Object.entries(result.registry.cookware)),
			warnings: [],
		});

		it("gives back the compiled `miseEnPlace` from its sections and registry", () => {
			const result = compile(getAST(RECIPE));
			expect(computeMiseEnPlace(result.sections, registryOf(result))).toEqual(
				result.miseEnPlace,
			);
		});

		it("lets calculatePreparationTime take the split instead of computing it again", () => {
			const result = compile(getAST(RECIPE));
			const registry = registryOf(result);
			const mise = computeMiseEnPlace(result.sections, registry);
			expect(calculatePreparationTime(result.sections, registry, mise)).toEqual(
				calculatePreparationTime(result.sections, registry),
			);
			expect(
				calculatePreparationTime(result.sections, registry, mise).total,
			).toBe(result.metrics.preparationTime);
		});
	});
});

describe("mise en place per working day (perSession)", () => {
	// Day -3: a cream that rests; day -1: a crust made from it, then assembly.
	const SOURCE = `## Cream ->&cream ~{-3d}

Whisk @milk{500ml} and @eggs{4}.

[Rest] Chill ~_{12h}.

## Crust ->&crust ~{-1d}

Mix &cream{100g} and @flour{200g}.

## Pie ~{-1d}

Fill with &crust{300g} and bake ~{30min}.
`;

	const compiled = () => schedulesOf(compile(getAST(SOURCE))).perSession;

	it("makes one session per anchored day, furthest first", () => {
		const { sessions } = compiled();
		expect(sessions.map((s) => [s.day, s.sections])).toEqual([
			[3, [0]],
			[1, [1, 2]],
		]);
		expect(sessions[0]!.end).toBeLessThanOrEqual(sessions[1]!.start);
	});

	it("gathers an intermediate made on an earlier day at the head of the day that uses it", () => {
		const { blocks, sessions } = compiled();
		const day1 = sessions[1]!;
		const gathered = blocks.filter(
			(b) => b.kind === "prep" && b.section === 1 && !b.deferred,
		);
		expect(gathered).toHaveLength(1);
		// The head of the day: before any step of that day.
		const firstStep = Math.min(
			...blocks
				.filter((b) => b.kind === "step" && day1.sections.includes(b.section))
				.map((b) => b.start),
		);
		expect(gathered[0]!.end).toBeLessThanOrEqual(firstStep);
		expect(gathered[0]!.start).toBe(day1.start);
	});

	it("waits to gather an intermediate made the same day", () => {
		const { blocks } = compiled();
		const deferred = blocks.filter((b) => b.kind === "prep" && b.deferred);
		// &crust is made on day 1 and used by the pie.
		const crust = deferred.find((b) => b.section === 2)!;
		expect(crust).toBeDefined();
		const crustEnd = Math.max(
			...blocks
				.filter((b) => b.kind === "step" && b.section === 1)
				.map((b) => b.end),
		);
		expect(crust.start).toBeGreaterThanOrEqual(crustEnd);
	});

	it("is one session, like upfront, without an anchor of a day or more", () => {
		const schedules = schedulesOf(compile(getAST(RECIPE)));
		expect(schedules.perSession.sessions).toHaveLength(1);
		expect(schedules.perSession.blocks).toEqual(schedules.upfront.blocks);
	});

	it("does not open a day for a long passive timer without a section anchor", () => {
		const schedules = schedulesOf(
			compile(
				getAST(
					"## Cream\n\nWhisk @milk{500ml}.\n\n[Rest] Chill ~_{48h}.\n\n## Pie\n\nBake @flour{200g} ~{30min}.\n",
				),
			),
		);
		expect(schedules.perSession.sessions).toHaveLength(1);
		expect(schedules.perSession.sessions[0]!.day).toBe(0);
	});

	it("keeps a section anchored under 24 hours on the day itself", () => {
		const schedules = schedulesOf(
			compile(
				getAST(
					"## Poolish ~{-18h} ->&poolish\n\nMix @flour{100g}.\n\n## Bread\n\nKnead &poolish{100g}.\n",
				),
			),
		);
		expect(schedules.perSession.sessions.map((s) => s.day)).toEqual([0]);
	});

	it("keeps the same preparation and active time as the other schedules", () => {
		const compiled = compile(getAST(SOURCE));
		const schedules = schedulesOf(compiled);
		const { metrics } = compiled;
		for (const mode of ["perSection", "upfront", "perSession"] as const) {
			const s = schedules[mode];
			const prep = s.blocks
				.filter((b) => b.kind === "prep")
				.reduce((sum, b) => sum + b.end - b.start, 0);
			expect(prep).toBeCloseTo(metrics.preparationTime);
			expect(s.idleTime).toBeCloseTo(
				s.totalTime - metrics.activeTime - metrics.preparationTime,
			);
		}
	});
});
