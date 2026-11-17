import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

describe("a percentage on a composite parent (INVALID_QUANTITY, relativeNotSupported)", () => {
	it("is said, and the parent reads with no quantity", () => {
		const result = compile(
			getAST("## S\n\nMix @flour{100 g} with @eggs{3}<@box{50% @&flour}>.\n"),
		);
		const eggs = result.sections[0]!.ingredients.find((i) => i.id === "eggs");
		expect(eggs?.qty).toBe(3);
		expect(eggs?.composite).toEqual({ parent: "box" });
		const [warning, ...rest] = result.warnings;
		expect(rest).toHaveLength(0);
		expect(warning?.code).toBe("INVALID_QUANTITY");
		expect(warning?.data).toEqual({ reason: "relativeNotSupported" });
		expect(warning?.message).toContain("not supported on a composite parent");
		expect(warning?.message).toContain('"50% @&flour"');
	});

	it("is said once for a percentage over zero (zeroDenominator only)", () => {
		const codes = compile(
			getAST("## S\n\nMix @flour{100 g} with @eggs{3}<@box{1/0% @&flour}>.\n"),
		).warnings.map((w) => w.data);
		expect(codes).toEqual([{ reason: "zeroDenominator" }]);
	});
});
