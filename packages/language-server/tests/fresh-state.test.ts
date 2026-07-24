import { describe, it, expect } from "bun:test";
import { resolveFreshState } from "../src/utils/fresh-state";
import { parseDocument } from "../src/document-state";

// Regression tests for the audit (2026-07-22, finding B5): refresh() is
// debounced (150ms), so the cached DocumentState can briefly lag behind the
// live document. Formatting/rename/code-action must never compute a
// TextEdit against that stale text — this is the staleness check extracted
// out of server.ts so it's testable without an LSP connection.

describe("resolveFreshState", () => {
	it("returns the cached state when the version matches the live document", () => {
		const cached = parseDocument("## Section\n\nStep.\n", {}, 3);
		const result = resolveFreshState(cached, "## Section\n\nStep.\n", 3, {});
		expect(result).toBe(cached);
	});

	it("re-parses when the cached version is behind the live document's version", () => {
		const stale = parseDocument("## Section\n\nOld step.\n", {}, 3);
		const liveText = "## Section\n\nNew step.\n";
		const result = resolveFreshState(stale, liveText, 4, {});
		expect(result).not.toBe(stale);
		expect(result.text).toBe(liveText);
		expect(result.version).toBe(4);
	});

	it("re-parses when there is no cached state yet", () => {
		const liveText = "## Section\n\nStep.\n";
		const result = resolveFreshState(undefined, liveText, 1, {});
		expect(result.text).toBe(liveText);
		expect(result.version).toBe(1);
	});

	it("falls back to comparing text when no version is available", () => {
		const cached = parseDocument("## Section\n\nStep.\n", {}, undefined);
		const sameText = resolveFreshState(
			cached,
			"## Section\n\nStep.\n",
			undefined,
			{},
		);
		expect(sameText).toBe(cached);

		const differentText = resolveFreshState(
			cached,
			"## Section\n\nDifferent.\n",
			undefined,
			{},
		);
		expect(differentText).not.toBe(cached);
		expect(differentText.text).toBe("## Section\n\nDifferent.\n");
	});
});
