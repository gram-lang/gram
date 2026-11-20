import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	type CompilationResult,
	compile,
	type ProcessedTimer,
	type RatioSpec,
	resolveRatio,
	resolveRatios,
	kitchenConverter,
	type Usage,
	WarningCode,
} from "../src/index";

const run = (body: string) => compile(getAST(`## Prep\n\n${body}\n`));

/** The section's usage named `name` (an alternative's options included). */
function usage(result: CompilationResult, name: string): Usage {
	for (const sec of result.sections) {
		for (const item of sec.ingredients) {
			if (item.id === name) return item;
			for (const opt of item.options ?? []) {
				if (typeof opt === "object" && "id" in opt && opt.id === name)
					return opt as Usage;
			}
		}
	}
	throw new Error(`no usage ${name}`);
}

function timers(result: CompilationResult): ProcessedTimer[] {
	return result.sections.flatMap((sec) =>
		sec.steps.flatMap((step) =>
			step.type === "step"
				? step.content.filter(
						(t): t is ProcessedTimer =>
							typeof t === "object" && "type" in t && t.type === "timer",
					)
				: [],
		),
	);
}

const codes = (result: CompilationResult) => result.warnings.map((w) => w.code);

const spec = (
	numerator: [number, string | null],
	denominator: [number, string | null],
): RatioSpec => ({
	numerator: {
		value: { type: "single", value: numerator[0] },
		unit: numerator[1],
	},
	denominator: { value: denominator[0], unit: denominator[1] },
	target: "flour",
	targetId: "flour",
	referenceType: "ingredient",
	raw: "",
});

describe("resolveRatio: the unit guardrail", () => {
	const kitchen = kitchenConverter()("flour");
	// A converter as the analyzer will bring: 1 l of the target weighs 500 g,
	// one piece 60 g.
	const analyzer = (value: number, from: string, to: string) => {
		const grams: Record<string, number> = { g: 1, kg: 1000, l: 500, "": 60 };
		const f = grams[from.toLowerCase()];
		const t = grams[to.toLowerCase()];
		return f === undefined || t === undefined ? null : (value * f) / t;
	};
	const amount = (
		s: RatioSpec,
		terms: [number, string | null][],
		final = false,
	) =>
		resolveRatio(
			s,
			terms.map(([value, unit]) => ({ value, unit })),
			final ? analyzer : kitchen,
			final,
		);

	it("resolves within one unit family", () => {
		expect(amount(spec([1, null], [100, "g"]), [[1, "kg"]])).toEqual({
			ok: true,
			amount: { value: { type: "single", value: 10 }, unit: null },
		});
		expect(amount(spec([15, "g"], [1, "l"]), [[500, "ml"]])).toMatchObject({
			ok: true,
			amount: { value: { value: 7.5 }, unit: "g" },
		});
	});

	it("adds up every term of the target", () => {
		expect(
			amount(spec([1, null], [100, "g"]), [
				[200, "g"],
				[50, "g"],
			]),
		).toMatchObject({ ok: true, amount: { value: { value: 2.5 } } });
	});

	it("matches a counting unit with its plural, and pieces with no unit", () => {
		expect(
			amount(spec([1, "tsp"], [2, "gousse"]), [[3, "gousses"]]),
		).toMatchObject({
			ok: true,
			amount: { value: { value: 1.5 }, unit: "tsp" },
		});
		expect(amount(spec([4, "min"], [1, null]), [[3, "pièces"]])).toMatchObject({
			ok: true,
			amount: { value: { value: 12 } },
		});
	});

	it("keeps a range, on either side", () => {
		expect(
			amount(spec([15, "g"], [100, "g"]), [
				[
					{ type: "range", value: 150, range: { min: 100, max: 200 } } as never,
					"g",
				],
			]),
		).toMatchObject({
			ok: true,
			amount: { value: { type: "range", range: { min: 15, max: 30 } } },
		});
	});

	it("defers what needs a density or a unit weight, in kitchen", () => {
		for (const [den, target] of [
			["g", "l"],
			[null, "g"],
			["g", null],
		] as const) {
			expect(amount(spec([1, null], [100, den]), [[1, target]])).toEqual({
				ok: false,
				reason: "deferred",
			});
		}
	});

	it("resolves it with the analyzer's converter, or says what is missing", () => {
		expect(amount(spec([1, null], [100, "g"]), [[1, "l"]], true)).toMatchObject(
			{
				ok: true,
				amount: { value: { value: 5 } },
			},
		);
		const none = () => null;
		const missing = (den: string | null, target: string | null) =>
			resolveRatio(
				spec([1, null], [1, den]),
				[{ value: 1, unit: target }],
				none,
				true,
			);
		expect(missing("g", "ml")).toEqual({ ok: false, reason: "missingDensity" });
		expect(missing(null, "g")).toEqual({
			ok: false,
			reason: "missingUnitWeight",
		});
		expect(missing("g", null)).toEqual({
			ok: false,
			reason: "missingUnitWeight",
		});
		expect(missing("gousse", "g")).toEqual({
			ok: false,
			reason: "incompatibleUnits",
		});
	});

	it("refuses two different counts, and a unit with a linking word, in both modes", () => {
		for (const final of [false, true]) {
			expect(
				amount(spec([1, null], [2, "tranches"]), [[3, "gousses"]], final),
			).toEqual({
				ok: false,
				reason: "incompatibleUnits",
			});
			expect(
				amount(spec([1, null], [100, "g de"]), [[1, "kg"]], final),
			).toEqual({
				ok: false,
				reason: "incompatibleUnits",
			});
		}
	});

	it("needs an amount of the target", () => {
		expect(amount(spec([1, null], [100, "g"]), [])).toEqual({
			ok: false,
			reason: "noTargetQuantity",
		});
	});
});

describe("ratios on ingredients", () => {
	it("resolves an ingredient, which keeps its numerator's unit", () => {
		const result = run(
			"Mix @flour{250 g}, @eggs{1 / 100 g @&flour} and @salt{2 g / 100 g @&flour}.",
		);
		expect(usage(result, "eggs").qty).toEqual({ type: "single", value: 2.5 });
		expect(usage(result, "eggs").unit).toBeUndefined();
		expect(usage(result, "salt")).toMatchObject({
			qty: { type: "single", value: 5 },
			unit: "g",
		});
		expect(usage(result, "eggs").formula).toMatchObject({
			raw: "1 / 100 g @&flour",
			target: "flour",
			isGhost: false,
		});
		expect(result.warnings).toEqual([]);
	});

	it("enters the shopping list like any amount", () => {
		const result = run(
			"Mix @flour{250 g} and @salt{2 g / 100 g @&flour}.\n\nAdd @salt{3 g}.",
		);
		expect(result.shopping_list).toContainEqual(
			expect.objectContaining({ id: "salt", qty: 8, unit: "g" }),
		);
	});

	it("follows a ratio whose target is itself a ratio", () => {
		const result = run(
			"Mix @flour{200 g}, @water{70 g / 100 g @&water2} and @water2{50 g / 100 g @&flour}.",
		);
		// water2 comes after water: its target is not in scope yet.
		expect(codes(result)).toContain(WarningCode.RELATIVE_QUANTITY_UNRESOLVED);
		const chained = run(
			"Mix @flour{200 g}, @water{50 g / 100 g @&flour} and @salt{2 g / 100 g @&water}.",
		);
		expect(usage(chained, "salt").qty).toEqual({ type: "single", value: 2 });
	});

	it("leaves for the analyzer a ratio whose target is a percentage", () => {
		const result = run(
			"Mix @flour{200 g}, @water{70% @&flour} and @salt{2 g / 100 g @&water}.",
		);
		expect(usage(result, "salt").qty).toMatchObject({ type: "RatioQuantity" });
		expect(result.warnings).toEqual([]);
	});

	it("leaves for the analyzer what needs a density or a unit weight", () => {
		const result = run("Mix @flour{250 g} and @milk{1 / 100 ml @&flour}.");
		expect(usage(result, "milk")).toMatchObject({
			qty: { type: "RatioQuantity", raw: "1 / 100 ml @&flour" },
		});
		expect(result.warnings).toEqual([]);
		expect(result.shopping_list).toContainEqual(
			expect.objectContaining({
				id: "milk",
				variable_entries: ["1 / 100 ml @&flour"],
			}),
		);
	});

	it("refuses mismatched counts with a warning that points at the ratio", () => {
		const source = "Mix @garlic{3 cloves} and @x{1 / 2 slices @&garlic}.";
		const result = run(source);
		const warning = result.warnings.find(
			(w) => w.code === WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS,
		);
		expect(warning?.message).toContain('"slices"');
		expect(
			`## Prep\n\n${source}\n`.slice(warning?.loc?.start, warning?.loc?.end),
		).toBe("1 / 2 slices @&garlic");
	});

	it("says to write the unit alone after a linking word", () => {
		const result = run("Mix @flour{250 g} and @x{1 / 100 g of @&flour}.");
		expect(result.warnings[0]?.message).toContain("write the unit alone");
	});

	it("resolves each option of an alternative for itself", () => {
		const result = run(
			"Mix @flour{200 g} and @butter{10 g / 100 g @&flour}|@oil{8 g / 100 g @&flour}.",
		);
		expect(usage(result, "butter").qty).toEqual({ type: "single", value: 20 });
		expect(usage(result, "oil").qty).toEqual({ type: "single", value: 16 });
	});

	it("takes a share of an earlier option of the same group", () => {
		const result = run(
			"Mix @flour{200 g} and @butter{100 g}|@oil{80 g / 100 g @&butter}.",
		);
		expect(usage(result, "oil").qty).toEqual({ type: "single", value: 80 });
	});

	it("resolves the step tokens like the section's list", () => {
		const result = run("Mix @flour{250 g} and @eggs{1 / 100 g @&flour}.");
		const step = result.sections[0]?.steps[0];
		const eggs =
			step?.type === "step"
				? step.content.find(
						(t) => typeof t === "object" && "id" in t && t.id === "eggs",
					)
				: undefined;
		expect((eggs as Usage).qty).toEqual({ type: "single", value: 2.5 });
	});
});

describe("ratios read and refused", () => {
	it("refuses `=` on a ratio, which always follows its target", () => {
		const result = run("Mix @flour{250 g} and @=eggs{1 / 100 g @&flour}.");
		expect(codes(result)).toEqual([WarningCode.INVALID_MODIFIER_COMBINATION]);
		expect(usage(result, "eggs").modifiers).toBeUndefined();
		expect(usage(result, "eggs").fixed).toBeUndefined();
		expect(usage(result, "eggs").qty).toEqual({ type: "single", value: 2.5 });
	});

	it("reads a ratio over zero, or with a refused number, as no amount", () => {
		const result = run(
			"Mix @flour{250 g}, @x{1 / 0 g @&flour} and @y{1 / 1/0 g @&flour}.",
		);
		expect(codes(result)).toEqual([
			WarningCode.INVALID_QUANTITY,
			WarningCode.INVALID_QUANTITY,
		]);
		expect(usage(result, "x").qty).toBeUndefined();
		expect(usage(result, "y").formula).toBeUndefined();
	});

	it("warns on a target out of scope, and on a ratio of itself", () => {
		expect(codes(run("Mix @x{2 g / 100 g @&unknown}."))).toEqual([
			WarningCode.RELATIVE_QUANTITY_UNRESOLVED,
		]);
		expect(codes(run("Mix @x{2 g / 100 g &unknown}."))).toEqual([
			WarningCode.VARIABLE_NOT_FOUND,
		]);
		expect(codes(run("Mix @flour{1 g} and @v{1 / 100 g @&v}."))).toContain(
			WarningCode.CIRCULAR_REFERENCE,
		);
	});

	it("refuses a ratio on a composite parent", () => {
		const result = run("Mix @yolks{3}<@eggs{1 / 100 g @&flour}>.");
		expect(result.warnings).toEqual([
			expect.objectContaining({
				code: WarningCode.INVALID_QUANTITY,
				message: expect.stringContaining("composite parent"),
			}),
		]);
	});

	it("flags an ambiguous number in a ratio", () => {
		expect(
			codes(run("Mix @flour{1 g} and @x{1,000 / 100 g @&flour}.")),
		).toEqual([WarningCode.AMBIGUOUS_NUMBER]);
	});
});

describe("ratios on references", () => {
	const source = `## Rice ->&rice

Cook @rice{200 g}.

## Stock

Pour @water{1 l}.

## Serve

Mix the &rice{200 g} with &stock{250 ml / 100 g &rice}, or &stock{250% &rice}.
`;

	it("resolves a ratio on a reference", () => {
		const result = compile(getAST(source));
		const stock = result.sections[2]?.ingredients.filter(
			(i) => i.name === "stock",
		);
		expect(stock?.[0]).toMatchObject({
			qty: { type: "single", value: 500 },
			unit: "ml",
		});
	});

	it("reads a percentage on a reference, for the analyzer", () => {
		const result = compile(getAST(source));
		const stock = result.sections[2]?.ingredients.filter(
			(i) => i.name === "stock",
		);
		expect(stock?.[1]).toMatchObject({
			qty: { type: "RelativeQuantity", percent: 250 },
			formula: { raw: "250% of rice", percent: 250, target: "rice" },
			dependencies: ["rice"],
		});
	});
});

describe("proportional times", () => {
	it("resolves a timer and counts it in the schedule", () => {
		const result = run("Roast @roast{1,2 kg} ~{15 min / 500 g @&roast}.");
		const [timer] = timers(result);
		expect(timer).toMatchObject({
			raw: "15 min / 500 g @&roast",
			quantity: { type: "single", value: 36 },
			unit: "min",
			minutes: 36,
			ratio: { raw: "15 min / 500 g @&roast", targetId: "roast" },
		});
		const step = result.sections[0]?.steps[0];
		expect(step?.type === "step" && step.timings.activeDuration).toBe(36);
		expect(result.tasks.tasks).toContainEqual(
			expect.objectContaining({ kind: "step", duration: { nominal: 36 } }),
		);
	});

	it("reads every form of duration, and a passive one per piece", () => {
		const hours = timers(
			run("Roast @roast{2 kg} ~{1:30 h / 1 kg @&roast}."),
		)[0];
		expect(hours?.minutes).toBe(180);
		const result = run("Fry @cutlets{4} ~_{4 min / @&cutlets}.");
		expect(timers(result)[0]?.minutes).toBe(16);
		expect(result.tasks.tasks).toContainEqual(
			expect.objectContaining({ kind: "passive", duration: { nominal: 16 } }),
		);
	});

	it("keeps a range of the numerator", () => {
		const [timer] = timers(
			run("Roast @roast{1 kg} ~{15-20 min / 500 g @&roast}."),
		);
		expect(timer?.quantity).toEqual({
			type: "range",
			value: 35,
			range: { min: 30, max: 40 },
		});
	});

	it("waits without a duration when the target weighs pieces", () => {
		const result = run("Fry @cutlets{800 g} ~{4 min / @&cutlets}.");
		const [timer] = timers(result);
		expect(timer?.minutes).toBeUndefined();
		expect(timer?.quantity).toBeUndefined();
		// The step takes the 2 minutes of a step with no duration.
		const step = result.sections[0]?.steps[0];
		expect(step?.type === "step" && step.timings.activeDuration).toBe(2);
		expect(result.warnings).toEqual([]);
	});

	it("refuses a multiplier, a range of the target and a proportional anchor", () => {
		const reasons = (body: string) =>
			compile(getAST(body)).warnings.map((w) => w.message);
		expect(
			reasons(
				"## Prep\n\nRoast @roast{1 kg} ~{15 min / 500 g @&roast * 2}.\n",
			)[0],
		).toContain("does not multiply a proportional time");
		expect(
			reasons("## Prep\n\nRoast @roast{1 kg} ~{15 min / 1-2 kg @&roast}.\n")[0],
		).toContain("the amount is a single number");
		expect(
			reasons(
				"## Roast ~{-15 min / 500 g @&roast}\n\nRoast @roast{1 kg}.\n",
			)[0],
		).toContain("not a proportional time");
	});
});

describe("resolveRatios", () => {
	it("gives the same result twice in a row, from what was written", () => {
		const result = run(
			"Mix @flour{250 g}, @eggs{1 / 100 g @&flour} and @salt{2 g / 100 g @&eggs}.\n\nRoast @flour{250 g} ~{15 min / 500 g @&flour}.",
		);
		const before = structuredClone(result.sections);
		const again = resolveRatios(result.sections, kitchenConverter(), {
			mode: "kitchen",
		});
		expect(again.timersChanged).toBe(false);
		expect(result.sections).toEqual(before);
	});

	it("follows a scaled target, and says when a timer changed", () => {
		const result = run("Roast @roast{1 kg} ~{15 min / 500 g @&roast}.");
		const roast = usage(result, "roast");
		roast.qty = 2;
		const step = result.sections[0]?.steps[0];
		if (step?.type === "step") {
			const token = step.content.find(
				(t) => typeof t === "object" && "id" in t && t.id === "roast",
			) as Usage;
			token.qty = 2;
		}
		const again = resolveRatios(result.sections, kitchenConverter(), {
			mode: "kitchen",
		});
		expect(again.timersChanged).toBe(true);
		expect(timers(result)[0]?.minutes).toBe(60);
	});
});
