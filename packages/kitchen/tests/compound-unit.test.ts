import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile, WarningCode } from "../src/index";

function unitWarnings(quantity: string) {
	const result = compile(getAST(`## Mix\n\nAdd @flour{${quantity}}.\n`));
	return result.warnings.filter((w) => w.code === WarningCode.INVALID_UNIT);
}

describe("a unit that reads as two quantities", () => {
	it("is flagged when a known unit, a number and another known unit follow", () => {
		for (const quantity of [
			"1 cup 5 tbsp",
			"1 kg 200 g",
			"1 cup 5tbsp",
			"2 c.à.s 1 c.à.c",
		]) {
			const warnings = unitWarnings(quantity);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]?.message).toContain("reads as two quantities");
			expect(warnings[0]?.message).toContain('of "flour"');
		}
	});

	it("is not flagged for a unit that a number only describes (a tin of 400 g)", () => {
		expect(unitWarnings("1 boîte de 400 g")).toHaveLength(0);
		expect(unitWarnings("2 boîtes 400 g")).toHaveLength(0);
	});

	it("is not flagged for a multi-word unit or a plain quantity", () => {
		for (const quantity of ["3 fl oz", "2 c. à soupe", "200 g", "1 3/4 cup"]) {
			expect(unitWarnings(quantity)).toHaveLength(0);
		}
	});
});
