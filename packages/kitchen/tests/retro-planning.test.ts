import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile, WarningCode } from "../src/index";

const compileSection = (header: string) =>
	compile(getAST(`## ${header}\nStep.\n`));

describe("section retro-planning", () => {
	it("compiles a negative signed duration with no warnings", () => {
		const result = compileSection("Dough ~{-2h}");
		expect(result.sections[0].retro_planning).toEqual({
			raw: "-2h",
			sign: -1,
			value: 2,
			unit: "h",
			minutes: -120,
		});
		expect(
			result.warnings.some(
				(w) => w.code === WarningCode.MISSING_UNIT || w.code === WarningCode.INVALID_UNIT,
			),
		).toBe(false);
	});

	it("converts a day-unit duration to minutes", () => {
		const result = compileSection("Dough ~{-2d}");
		expect(result.sections[0].retro_planning).toEqual({
			raw: "-2d",
			sign: -1,
			value: 2,
			unit: "d",
			minutes: -2880,
		});
	});

	it("resolves the French day alias 'j' via the shared i18n dictionary", () => {
		const result = compileSection("Pâte ~{-2j}");
		expect(result.sections[0].retro_planning).toEqual({
			raw: "-2j",
			sign: -1,
			value: 2,
			unit: "d",
			minutes: -2880,
		});
		expect(
			result.warnings.some((w) => w.code === WarningCode.INVALID_UNIT),
		).toBe(false);
	});

	it("normalizes 'min' unit and computes minutes directly", () => {
		const result = compileSection("Dough ~{-30min}");
		expect(result.sections[0].retro_planning).toEqual({
			raw: "-30min",
			sign: -1,
			value: 30,
			unit: "min",
			minutes: -30,
		});
	});

	it("warns MISSING_UNIT and degrades to raw-only for a bare number with no unit", () => {
		const result = compileSection("Dough ~{-5}");
		expect(result.sections[0].retro_planning).toEqual({ raw: "-5" });
		expect(
			result.warnings.some((w) => w.code === WarningCode.MISSING_UNIT),
		).toBe(true);
	});

	it("warns MISSING_UNIT and degrades to raw-only for free text", () => {
		const result = compileSection("Dough ~{la veille}");
		expect(result.sections[0].retro_planning).toEqual({ raw: "la veille" });
		expect(
			result.warnings.some((w) => w.code === WarningCode.MISSING_UNIT),
		).toBe(true);
	});

	it("warns INVALID_UNIT and degrades to raw-only for an unrecognized unit", () => {
		const result = compileSection("Dough ~{-5xyz}");
		expect(result.sections[0].retro_planning).toEqual({ raw: "-5xyz" });
		expect(
			result.warnings.some((w) => w.code === WarningCode.INVALID_UNIT),
		).toBe(true);
	});

	describe("strictly-negative rule", () => {
		it("rejects an unsigned (positive) duration even with a valid unit", () => {
			const result = compileSection("Dough ~{2d}");
			expect(result.sections[0].retro_planning).toEqual({ raw: "2d" });
			expect(
				result.warnings.some((w) => w.code === WarningCode.MISSING_UNIT),
			).toBe(true);
		});

		it("rejects a zero-value duration regardless of sign", () => {
			const positiveZero = compileSection("Dough ~{0h}");
			const negativeZero = compileSection("Dough ~{-0h}");
			for (const result of [positiveZero, negativeZero]) {
				expect(
					result.warnings.some((w) => w.code === WarningCode.MISSING_UNIT),
				).toBe(true);
			}
			expect(positiveZero.sections[0].retro_planning).toEqual({ raw: "0h" });
			expect(negativeZero.sections[0].retro_planning).toEqual({ raw: "-0h" });
		});
	});
});
