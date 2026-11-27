import { describe, expect, it } from "bun:test";
import type { LintDiagnostic, TextPatch } from "@gram-lang/modules/lint";
import { invariantsById, mapSpan } from "../src/invariants";
import { FUZZ_URI, type Outcome, Prepared } from "../src/prepared";

const [invariant] = invariantsById(["fix-idempotent"]);
const check = (p: Prepared) => invariant!.check(p);

const TITLE = "---\ntitle: T\n---\n\n## A\n\n";

/** A source whose lint is replaced: the fixed text is still linted for real. */
class WithLint extends Prepared {
	constructor(
		source: string,
		readonly lintOf: (real: LintDiagnostic[]) => LintDiagnostic[],
	) {
		super(source, {});
	}

	override get lint(): Outcome<LintDiagnostic[]> {
		const real = super.lint;
		return real.ok ? { ...real, value: this.lintOf(real.value) } : real;
	}
}

const patch = (start: number, end: number, replacement: string): TextPatch => ({
	start,
	end,
	replacement,
});

/** One diagnostic of `code` over `[start, end)`, its preferred fix the given patch. */
const crafted = (
	code: string,
	loc: { start: number; end: number },
	fix: TextPatch,
): LintDiagnostic => ({
	code,
	severity: "warning",
	uri: FUZZ_URI,
	loc,
	message: "crafted",
	fixes: [
		{
			title: "crafted",
			edits: [{ kind: "patch", uri: FUZZ_URI, patches: [fix] }],
			isPreferred: true,
		},
	],
});

describe("mapSpan", () => {
	it("moves a span past text inserted at its start, not at its end", () => {
		expect(mapSpan([patch(4, 4, "\n")], { start: 4, end: 9 })).toEqual({
			start: 5,
			end: 10,
		});
		expect(mapSpan([patch(9, 9, "!")], { start: 4, end: 9 })).toEqual({
			start: 4,
			end: 9,
		});
	});

	it("shifts by what a replacement before it adds or removes", () => {
		expect(mapSpan([patch(0, 3, "x")], { start: 5, end: 8 })).toEqual({
			start: 3,
			end: 6,
		});
	});

	it("brings an edge inside a replaced range to the edge of its replacement", () => {
		expect(mapSpan([patch(2, 6, "abc")], { start: 4, end: 8 })).toEqual({
			start: 2,
			end: 7,
		});
		expect(mapSpan([patch(4, 10, "")], { start: 4, end: 8 })).toEqual({
			start: 4,
			end: 4,
		});
	});
});

describe("fix-idempotent", () => {
	it("holds on fixes that do their job, over two passes' worth of problems", () => {
		const p = new Prepared(
			`${TITLE}Mix @flour{1} ->&d\n&flour again ~{15%min}.\n\nServe &d.\n`,
			{},
		);
		expect(p.fixed!.applied.length).toBeGreaterThan(0);
		expect(check(p)).toBeNull();
	});

	it("does not take a line moving up to where a removed one began for the removed one", () => {
		// Removing `servings:` brings `yields:` (the same code, another key) to
		// the very offset where `servings` was.
		const source =
			"---\ntitle: T\nportions: 4\nservings: 4\nyields: 2\n---\n\nMix @a{1}.\n";
		const p = new WithLint(source, (real) =>
			real.filter((d) => d.message.includes('"servings"')),
		);
		expect(p.fixed!.applied.map((a) => a.fix.title)).toEqual([
			"Remove 'servings' ('portions' is the key read)",
		]);
		expect(p.fixed!.after.source).toContain("\nyields: 2\n");
		expect(check(p)).toBeNull();
	});

	it("catches a fix after which the same code is still there, whatever its message", () => {
		const source = `${TITLE}Boil ~{15%min}.\n`;
		const at = source.indexOf("15%min");
		const p = new WithLint(source, () => [
			crafted(
				"INVALID_DURATION",
				{ start: at - 2, end: at + 7 },
				patch(at, at + 6, "16%min"),
			),
		]);
		expect(check(p)?.message).toBe(
			"INVALID_DURATION comes back after its preferred fix",
		);
	});

	it("catches a fix that breaks the parse", () => {
		const source = `${TITLE}Mix.\n`;
		const end = source.length;
		const p = new WithLint(source, () => [
			crafted(
				"MERGED_STEP_LINE",
				{ start: 0, end: 3 },
				patch(end, end, "\n[U]"),
			),
		]);
		expect(check(p)?.message).toBe(
			"the preferred fixes of MERGED_STEP_LINE break the parse",
		);
	});
});
