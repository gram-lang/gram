import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { WarningCode } from "../src/warnings";

const spaced = (step: string) => {
	const source = `---\ntitle: T\n---\n\n## Prep\n\n${step}\n`;
	return {
		source,
		warnings: compile(getAST(source)).warnings.filter(
			(w) => w.code === WarningCode.SPACED_COMPOSITE,
		),
	};
};

// With spaces around `<`, a composite reads as two separate ingredients and
// the parent is bought on top of the child: the warning makes that visible.
describe("SPACED_COMPOSITE", () => {
	it("warns on spaces on both sides of '<'", () => {
		const { source, warnings } = spaced(
			"Zest @lemon zest{1} < @lemon{2} finely.",
		);
		expect(warnings).toHaveLength(1);
		const [w] = warnings;
		expect(w?.item).toBe("lemon zest");
		expect(w?.data).toEqual({ suggestion: "<@lemon" });
		expect(w?.message).toContain('"lemon zest" and "lemon"');
		// The range runs from the child to the parent, both included.
		expect(source.slice(w!.loc!.start, w!.loc!.end)).toBe(
			"@lemon zest{1} < @lemon{2}",
		);
	});

	it("warns on a space on one side only", () => {
		expect(spaced("Add @yolks{3} <@eggs{3}.").warnings).toHaveLength(1);
		expect(spaced("Add @yolks{3}< @eggs{3}.").warnings).toHaveLength(1);
	});

	it("warns on bare names and several spaces", () => {
		expect(spaced("Add @zest  <  @lemon.").warnings).toHaveLength(1);
	});

	it("stays silent on a glued composite", () => {
		expect(spaced("Zest @lemon zest{1}<@lemon{2}.").warnings).toEqual([]);
	});

	it("stays silent on '<' in prose", () => {
		expect(spaced("Keep it < 5 cm thick with @flour{10g}.").warnings).toEqual(
			[],
		);
		expect(spaced("Heat < @butter{20g} melts.").warnings).toEqual([]);
		expect(spaced("Use #pan < @butter{20g}.").warnings).toEqual([]);
	});

	it("stays silent when '<' sits between ingredients among other words", () => {
		expect(spaced("Add @sugar{10g} if < 2 and @salt{1g}.").warnings).toEqual(
			[],
		);
	});
});
