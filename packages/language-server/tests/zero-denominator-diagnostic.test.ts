import { describe, expect, it } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideDiagnostics } from "../src/features/diagnostics";

describe("zero denominator diagnostic", () => {
	it("warns on a fraction over zero, which used to vanish silently", () => {
		const text = "---\ntitle: T\n---\n## T\n\nAdd @flour{1/0 cups}.\n";
		const diags = provideDiagnostics(parseDocument(text));
		expect(diags).toHaveLength(1);
		expect(diags[0]!.severity).toBe(2);
		expect(diags[0]!.message).toContain('Number "1/0" of "flour"');
		// Under `{1/0 cups}`, on the line of the step.
		expect(diags[0]!.range.start.line).toBe(5);
	});
});
