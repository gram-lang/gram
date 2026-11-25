import { describe, it, expect } from "bun:test";
import { DiagnosticSeverity } from "vscode-languageserver";
import { parseDocument } from "../src/document-state";
import { provideDiagnostics } from "../src/features/diagnostics";

describe("provideDiagnostics — shared warningSeverity map", () => {
	it("reports a structural issue (undefined reference) as Error", () => {
		const state = parseDocument("## Section\nUse &ghost.\n");
		const diags = provideDiagnostics(state);
		const undefinedRef = diags.find((d) => d.code === "UNDEFINED_REFERENCE");
		expect(undefinedRef?.severity).toBe(DiagnosticSeverity.Error);
	});

	it("reports a nutritional/estimation-style issue (missing timer unit) as Warning, not Error", () => {
		const state = parseDocument("## Section\nWait for ~timer{10}.\n");
		const diags = provideDiagnostics(state);
		const missingUnit = diags.find((d) => d.code === "MISSING_UNIT");
		expect(missingUnit?.severity).toBe(DiagnosticSeverity.Warning);
	});
});

describe("DAY_OVERFLOW", () => {
	const OVERFLOWING =
		"---\ntitle: Bread\n---\n\n## Dough ~{-1d} ->&dough\n\nMix @flour{500g}.\n\nFerment ~_{50h}.\n\n## Bake\n\nBake &dough{500g} ~{30min}.\n";

	it("squiggles the section whose day a long rest pushes out of its 24 hours", () => {
		const state = parseDocument(OVERFLOWING);
		const found = provideDiagnostics(state).filter(
			(d) => d.code === "DAY_OVERFLOW",
		);
		expect(found).toHaveLength(1);
		expect(found[0]!.severity).toBe(2); // warning
		expect(found[0]!.message).toContain("Working day 1");
		// Anchored on the section heading's line, not at the top of the file.
		expect(found[0]!.range.start.line).toBe(4);
	});

	it("is silent when the rest fits the day", () => {
		const state = parseDocument(OVERFLOWING.replace("50h", "10h"));
		expect(
			provideDiagnostics(state).some((d) => d.code === "DAY_OVERFLOW"),
		).toBe(false);
	});
});

describe("UNUSED_INTERMEDIATE", () => {
	const unused = (text: string) =>
		provideDiagnostics(parseDocument(text))
			.filter((d) => d.code === "UNUSED_INTERMEDIATE")
			.map((d) => d.message);

	it("flags a step intermediate that nothing uses", () => {
		expect(
			unused(
				"---\ntitle: T\n---\n\n## Prep\n\nMix @flour{500g} ->&dough.\n\nBake @butter{20g}.\n",
			),
		).toEqual(["Intermediate '->&dough' is declared but never used."]);
	});

	it("counts the target of a share as a use", () => {
		expect(
			unused(
				"---\ntitle: T\n---\n\n## Prep\n\nMix @flour{500g} ->&dough.\n\nSalt with @salt{2% &dough}.\n",
			),
		).toEqual([]);
	});

	it("counts the target of a ratio as a use", () => {
		expect(
			unused(
				"---\ntitle: T\n---\n\n## Prep\n\nMix @flour{500g} ->&dough.\n\nSalt with @salt{2 g / 100 g &dough}.\n",
			),
		).toEqual([]);
	});

	it("counts the target of a proportional timer as a use", () => {
		expect(
			unused(
				"---\ntitle: T\n---\n\n## Prep\n\nMix @flour{500g} ->&dough.\n\nBake ~{15 min / 500 g &dough}.\n",
			),
		).toEqual([]);
	});

	it("never flags an intermediate declared on a section heading", () => {
		expect(
			unused(
				"---\ntitle: Base\n---\n\n## Dough ->&dough\n\nMix @flour{500g}.\n\n## Sauce ->&sauce\n\nSimmer @tomato{400g}.\n",
			),
		).toEqual([]);
	});
});
