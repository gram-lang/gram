import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { WarningCode, warningSeverity } from "../src/warnings";

const overlaps = (source: string) =>
	compile(getAST(source)).warnings.filter(
		(w) => w.code === WarningCode.PASSIVE_OVERLAP_SAME_COOKWARE,
	);

describe("PASSIVE_OVERLAP_SAME_COOKWARE", () => {
	it("warns when two timers overlap in steps that cite the same cookware, with no track", () => {
		const found = overlaps(`## Tarts

[Bake] The tarts in the #oven for ~_{30min}.

## Bread

[Bake] The loaf in the #oven for ~_{20min}.

## Serve

[Serve] Everything.
`);
		expect(found).toHaveLength(1);
		expect(found[0]!.message).toContain("#oven");
		expect(found[0]!.message).toContain("named track");
		expect(found[0]!.message).toContain("section 'Tarts'");
		expect(found[0]!.message).toContain("section 'Bread'");
		expect(warningSeverity[WarningCode.PASSIVE_OVERLAP_SAME_COOKWARE]).toBe(
			"info",
		);
	});

	it("is quiet when the timers share a named track", () => {
		expect(
			overlaps(`## Tarts

[Bake] The tarts in the #oven for ~_oven{30min}.

## Bread

[Bake] The loaf in the #oven for ~_oven{20min}.

## Serve

[Serve] Everything.
`),
		).toHaveLength(0);
	});

	it("is quiet for two different pieces of cookware", () => {
		expect(
			overlaps(`## Tarts

[Bake] The tarts in the #oven for ~_{30min}.

## Stock

[Simmer] The stock in the #pot for ~_{20min}.

## Serve

[Serve] Everything.
`),
		).toHaveLength(0);
	});

	it("is quiet when the timers do not overlap", () => {
		expect(
			overlaps(`## Tarts ->&tarts

[Bake] The tarts in the #oven for ~_{30min}.

## Bread

[Bake] The loaf with &tarts in the #oven for ~_{20min}.
`),
		).toHaveLength(0);
	});

	it("is quiet for the timers of a single step", () => {
		expect(
			overlaps(`## Bake

[Bake] In the #oven, 10 min at first ~_{10min} then 20 min ~_{20min}.
`),
		).toHaveLength(0);
	});
});
