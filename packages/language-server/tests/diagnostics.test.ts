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

describe("SESSION_OVERFLOW", () => {
	const OVERFLOWING =
		"---\ntitle: Bread\n---\n\n## Dough ~{-1d} ->&dough\n\nMix @flour{500g}.\n\nFerment ~_{50h}.\n\n## Bake\n\nBake &dough{500g} ~{30min}.\n";

	it("squiggles the section whose day a long rest pushes out of its 24 hours", () => {
		const state = parseDocument(OVERFLOWING);
		const found = provideDiagnostics(state).filter(
			(d) => d.code === "SESSION_OVERFLOW",
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
			provideDiagnostics(state).some((d) => d.code === "SESSION_OVERFLOW"),
		).toBe(false);
	});
});
