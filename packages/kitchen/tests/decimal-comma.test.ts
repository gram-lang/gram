import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	applyScale,
	compile,
	quantityToMinutes,
	WarningCode,
} from "../src/index";

const compileStep = (step: string) => compile(getAST(`## Mix\n\n${step}\n`));

const ambiguous = (step: string) =>
	compileStep(step).warnings.filter(
		(w) => w.code === WarningCode.AMBIGUOUS_NUMBER,
	);

describe("a decimal comma", () => {
	it("is a decimal: a quantity, its mass unit and its scaling stay right", () => {
		const result = compileStep("Add @flour{1,5 kg}.");
		const flour = result.sections[0]?.ingredients[0];
		expect(flour?.qty).toBe(1.5);
		expect(result.warnings).toEqual([]);

		const doubled = applyScale(result, 2).sections[0]?.ingredients[0];
		expect(doubled?.qty).toBe(3);
	});

	it("is read in a timer, which lasts 90 minutes", () => {
		const result = compileStep("Bake ~{1,5 h}.");
		expect(result.warnings).toEqual([]);
		const step = result.sections[0]?.steps[0];
		const timer =
			step?.type === "step"
				? step.content.find((t) => typeof t === "object" && t.type === "timer")
				: undefined;
		expect(
			timer && quantityToMinutes({ value: timer.quantity, unit: timer.unit }),
		).toBe(90);
	});
});

describe("a comma that could be a thousands separator (1,000)", () => {
	it("is read as a decimal, with a warning that says how it was read", () => {
		const [warning, ...rest] = ambiguous("Add @flour{1,000 kg}.");
		expect(rest).toEqual([]);
		expect(warning?.item).toBe("flour");
		expect(warning?.message).toContain('"1,000"');
		expect(warning?.message).toContain("read as 1");
		expect(warning?.message).toContain("1000");

		const flour = compileStep("Add @flour{1,000 kg}.").sections[0]
			?.ingredients[0];
		expect(flour?.qty).toBe(1);
	});

	it("is flagged on every element that holds a number", () => {
		for (const step of [
			"Add @flour{12,500 g}.",
			"Add @flour{1,000-2,000 g}.",
			"Take #molds{1,000}.",
			"Bake ~{1,000 min}.",
			"Heat ^{1,000 °C}.",
			"Add @sugar{1,000 g}|@honey{2 tbsp}.",
			"Add @zest{1,000 g}<@lemon{1}.",
			"Add @lemon{1} then @zest{1}<@lemon{1,000}.",
		]) {
			expect(ambiguous(step)).toHaveLength(1);
		}
	});

	it("is not flagged for a decimal that cannot be one, or a point", () => {
		for (const step of [
			"Add @flour{0,125 kg}.",
			"Add @flour{1,25 kg}.",
			"Add @flour{1.000 kg}.",
			"Add @flour{0.125 kg}.",
			"Add @flour{1000 g}.",
		]) {
			expect(ambiguous(step)).toEqual([]);
		}
	});
});
