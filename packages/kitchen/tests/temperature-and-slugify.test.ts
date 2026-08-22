import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile, slugify, WarningCode, warningSeverity } from "../src/index";

describe("warningSeverity", () => {
	it("treats structural integrity issues as errors", () => {
		expect(warningSeverity[WarningCode.UNDEFINED_REFERENCE]).toBe("error");
		expect(warningSeverity[WarningCode.CIRCULAR_REFERENCE]).toBe("error");
		expect(warningSeverity[WarningCode.SCOPE_CONFLICT]).toBe("error");
	});

	it("treats nutritional/estimation and incomplete-annotation gaps as warnings, not errors", () => {
		expect(warningSeverity[WarningCode.RELATIVE_QUANTITY_UNKNOWN_MASS]).toBe(
			"warning",
		);
		expect(warningSeverity[WarningCode.MISSING_UNIT]).toBe("warning");
		expect(warningSeverity[WarningCode.INVALID_UNIT]).toBe("warning");
		expect(warningSeverity[WarningCode.MISSING_INGREDIENT]).toBe("warning");
	});

	it("treats macro gaps, unknown mass, and track contention as info", () => {
		expect(warningSeverity[WarningCode.MISSING_MACROS]).toBe("info");
		expect(warningSeverity[WarningCode.UNKNOWN_MASS]).toBe("info");
		expect(warningSeverity[WarningCode.TRACK_CONTENTION]).toBe("info");
	});

	it("has an entry for every WarningCode", () => {
		for (const code of Object.values(WarningCode)) {
			expect(warningSeverity[code]).toBeDefined();
		}
	});
});

const compileStep = (line: string) => compile(getAST(`## Section\n${line}\n`));

describe("temperature unit validation and normalization", () => {
	it.each([
		["C", "°C"],
		["c", "°C"],
		["°C", "°C"],
		["°c", "°C"],
		["F", "°F"],
		["f", "°F"],
		["°F", "°F"],
		["°f", "°F"],
	])("normalizes ^{180%s} to unit %s", (input, expected) => {
		const result = compileStep(`Bake at ^{180${input}}.`);
		const temp = result.sections[0].steps[0].content.find(
			(c: any) => c?.type === "temperature",
		);
		expect(temp.unit).toBe(expected);
		expect(
			result.warnings.some((w) => w.code === WarningCode.INVALID_UNIT),
		).toBe(false);
	});

	it("warns INVALID_UNIT for an unrecognized unit and preserves the raw value", () => {
		const result = compileStep("Bake at ^{180K}.");
		const temp = result.sections[0].steps[0].content.find(
			(c: any) => c?.type === "temperature",
		);
		expect(temp.unit).toBe("K");
		expect(
			result.warnings.some((w) => w.code === WarningCode.INVALID_UNIT),
		).toBe(true);
	});

	it("still treats qualitative text (no digits) as a semantic temperature, not a unit warning", () => {
		const result = compileStep("Bake at ^{medium heat}.");
		const temp = result.sections[0].steps[0].content.find(
			(c: any) => c?.type === "temperature",
		);
		expect(temp.text).toBe("medium heat");
		expect(
			result.warnings.some((w) => w.code === WarningCode.INVALID_UNIT),
		).toBe(false);
	});
});

describe("slugify", () => {
	it("folds Latin diacritics to their base letter", () => {
		expect(slugify("crème fraîche")).toBe("creme-fraiche");
	});

	it("preserves non-Latin letters instead of stripping them", () => {
		expect(slugify("味噌")).toBe("味噌");
		expect(slugify("醤油")).not.toBe(slugify("味噌"));
	});

	it("falls back to a deterministic short hash when the slug would otherwise be empty", () => {
		const slug = slugify("🔥🔥🔥");
		expect(slug).not.toBe("");
		expect(slug).toBe(slugify("🔥🔥🔥"));
	});
});
