import { describe, it, expect } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideDiagnostics } from "../src/features/diagnostics";

// Issue #24: an unreadable `{...}` quantity is now a hard parse error. The
// editor must surface it as an error squiggle on the offending brace.
describe("malformed quantity diagnostic", () => {
	it("underlines the opening brace of an unreadable quantity", () => {
		const text = "## T\n\nAdd @sel{1 g/l} to water.\n";
		const diags = provideDiagnostics(parseDocument(text));
		expect(diags).toHaveLength(1);
		expect(diags[0]!.severity).toBe(1);
		expect(diags[0]!.message).toContain("Invalid quantity '{1 g/l}'");
		expect(diags[0]!.range.start).toEqual({ line: 2, character: 8 });
	});
});
