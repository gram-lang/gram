import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

const warningsOf = (step: string) =>
	compile(getAST(`## S\n\n${step}\n`)).warnings.filter(
		(w) => w.code === "INVALID_QUANTITY",
	);

describe("a fraction over zero (INVALID_QUANTITY, zeroDenominator)", () => {
	it("is said on every element that holds a number", () => {
		for (const step of [
			"Add @flour{1/0 cups}.",
			"Add @flour{1 1/0 cup}.",
			"Add @flour{1/0-2 cup}.",
			"Add @flour{1/0 cup + 1 tbsp}.",
			"Use #pan{1/0}.",
			"Heat ^{1/0 °C}.",
			"Add @juice<@lemon{1/0}>{1}.",
		]) {
			const [warning, ...rest] = warningsOf(step);
			expect(rest).toHaveLength(0);
			expect(warning?.data).toEqual({ reason: "zeroDenominator" });
			expect(warning?.message).toContain("0 below the bar");
		}
	});

	it("points at the term of a sum that holds it", () => {
		const [warning] = warningsOf("Add @flour{1 tbsp + 1/0 cup}.");
		expect(warning?.loc).toEqual({ start: 26, end: 33 }); // "1/0 cup"
	});

	it("leaves a percentage over zero with no quantity, never 1%", () => {
		const result = compile(
			getAST("## S\n\nAdd @flour{100 g}.\n\nAdd @salt{1/0% @&flour}.\n"),
		);
		const salt = result.sections[0]!.ingredients.find((i) => i.id === "salt");
		expect(salt?.qty).toBeUndefined();
		expect(salt?.formula).toBeUndefined();
		expect(result.warnings.map((w) => w.code)).toEqual(["INVALID_QUANTITY"]);
	});

	it("leaves a timer to INVALID_DURATION", () => {
		const codes = compile(getAST("## S\n\nWait ~{1/0 min}.\n")).warnings.map(
			(w) => w.code,
		);
		expect(codes).toEqual(["INVALID_DURATION"]);
	});
});

describe("a ratio per zero of its target (INVALID_QUANTITY, zeroRatioDenominator)", () => {
	it("quotes the denominator, not the whole ratio as a number", () => {
		const [warning, ...rest] = warningsOf(
			"Add @flour{100 g} and @eggs{1 / 0 g @&flour}.",
		);
		expect(rest).toHaveLength(0);
		expect(warning?.data).toEqual({ reason: "zeroRatioDenominator" });
		expect(warning?.message).toBe(
			'"eggs" is per "0 g": a ratio cannot be per nothing of its target: write the amount it is per (e.g. / 100 g). It is left out, as if no amount had been written.',
		);
	});

	it("speaks of a timer, never of a type name, and of the total time", () => {
		const [warning] = warningsOf("Roast @roast{1 kg} ~{15 min / 0 g @&roast}.");
		expect(warning?.data).toEqual({ reason: "zeroRatioDenominator" });
		expect(warning?.message).toStartWith('A timer is per "0 g": ');
		expect(warning?.message).toEndWith("It is not counted in the total time.");
		expect(warning?.message).not.toContain("fraction");
	});

	it("names a named timer", () => {
		const [warning] = warningsOf(
			"Roast @roast{1 kg} ~roast{15 min / 0 kg @&roast}.",
		);
		expect(warning?.message).toStartWith('Timer "roast" is per "0 kg": ');
		expect(warning?.message).toEndWith("It is not counted in the total time.");
	});
});
