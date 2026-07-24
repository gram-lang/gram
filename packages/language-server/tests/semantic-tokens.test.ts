import { describe, it, expect } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideSemanticTokens } from "../src/features/semantic-tokens";

// Regression tests for the audit (2026-07-22, parser finding I3): the
// top-level `for (const section of state.ast.children) walkSection(...)`
// loop assumed every top-level child was a Section — a bare top-level
// Comment crashed inside `walkSection` (`.children` doesn't exist on
// `CommentAST`), and a bare top-level Step's tokens (ingredients, etc.)
// were silently never highlighted at all.

describe("provideSemanticTokens on non-Section top-level content", () => {
	it("does not throw on a headerless recipe with a leading comment", () => {
		const state = parseDocument("// just a note\nMix @flour{200g}.\n");
		expect(() => provideSemanticTokens(state)).not.toThrow();
	});

	it("still emits tokens for a bare top-level step's ingredient", () => {
		const state = parseDocument("Mix @flour{200g}.\n");
		const { data } = provideSemanticTokens(state);
		expect(data.length).toBeGreaterThan(0);
	});

	it("still emits tokens for a real section, unaffected by the fix", () => {
		const state = parseDocument("## Batter\n\nMix @flour{200g}.\n");
		const { data } = provideSemanticTokens(state);
		expect(data.length).toBeGreaterThan(0);
	});
});
