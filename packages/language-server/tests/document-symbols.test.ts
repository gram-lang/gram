import { describe, it, expect } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideDocumentSymbols } from "../src/features/document-symbols";

// Regression tests for the audit (2026-07-22, parser finding I3): this
// feature's `state.ast.children.map((section: SectionAST) => ...)` lied
// about every top-level child being a Section — a bare top-level Comment
// crashed (`.children` doesn't exist on `CommentAST`), and a bare top-level
// Step was silently dropped from the outline entirely.

describe("provideDocumentSymbols on non-Section top-level content", () => {
	it("does not throw on a headerless recipe with a leading comment", () => {
		const state = parseDocument("// just a note\nMix @flour{200g}.\n");
		expect(() => provideDocumentSymbols(state)).not.toThrow();
	});

	it("still produces an outline entry for a bare top-level step", () => {
		const state = parseDocument("[Mix] Add @flour{200g}.\n");
		const symbols = provideDocumentSymbols(state);
		expect(symbols).toHaveLength(1);
		expect(symbols[0]?.name).toBe("Mix");
	});

	it("still produces a Module symbol for a real section, unaffected by the fix", () => {
		const state = parseDocument("## Batter\n\n[Mix] Add @flour{200g}.\n");
		const symbols = provideDocumentSymbols(state);
		expect(symbols).toHaveLength(1);
		expect(symbols[0]?.name).toBe("Batter");
		expect(symbols[0]?.children?.[0]?.name).toBe("Mix");
	});
});
