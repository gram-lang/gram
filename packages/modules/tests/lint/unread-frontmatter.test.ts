import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { applyFix, lintCode, lintText, spanOf } from "./lint-helpers";

const unread = (text: string) => lintCode("UNREAD_FRONTMATTER", text);

describe("UNREAD_FRONTMATTER", () => {
	it("flags a '# …' line that empties the frontmatter, on that line, with a fix that removes it", () => {
		const text =
			"---\ntitle: Pâte à crêpes\n# Champs fonctionnels\nportions: 4\n---\n\nMélanger @farine{250 g}.\n";
		const [d, ...rest] = unread(text);
		expect(rest).toEqual([]);
		expect(d!.severity).toBe("warning");
		expect(spanOf(text, d!)).toBe("# Champs fonctionnels");
		const [fix] = d!.fixes!;
		expect(fix!.isPreferred).toBeUndefined();
		const fixed = applyFix(text, fix!);
		expect(getAST(fixed).meta).toEqual({
			title: "Pâte à crêpes",
			portions: "4",
		});
		expect(unread(fixed)).toEqual([]);
	});

	it("flags an indented line, with no fix: removing it would lose data", () => {
		const text =
			"---\ntitle: Bread\ndensities:\n  - flour: 0.55\n---\n\nMix @flour{500 g}.\n";
		const [d] = unread(text);
		expect(spanOf(text, d!)).toBe("  - flour: 0.55");
		expect(d!.message).toContain("densities: [flour:0.55]");
		expect(d!.fixes).toBeUndefined();
	});

	it("replaces MISSING_TITLE when the title is written in the unread block", () => {
		const codes = lintText("---\ntitle: X\n# note\n---\n\nMix @a{1}.\n").map(
			(d) => d.code,
		);
		expect(codes).toContain("UNREAD_FRONTMATTER");
		expect(codes).not.toContain("MISSING_TITLE");
	});

	it("keeps MISSING_TITLE when the unread block has no title either", () => {
		const codes = lintText("---\nportions: 2\n# note\n---\n\nMix @a{1}.\n").map(
			(d) => d.code,
		);
		expect(codes).toContain("UNREAD_FRONTMATTER");
		expect(codes).toContain("MISSING_TITLE");
	});

	it("handles CRLF line breaks", () => {
		const text = "---\r\ntitle: X\r\n# note\r\n---\r\n\r\nMix @a{1}.\r\n";
		const [d] = unread(text);
		expect(spanOf(text, d!)).toBe("# note");
		expect(getAST(applyFix(text, d!.fixes![0]!)).meta).toEqual({ title: "X" });
	});

	it("does not flag a frontmatter that is read, a file without one, or one still being written", () => {
		expect(unread("---\ntitle: X\nportions: 4\n---\n\nMix.\n")).toEqual([]);
		expect(unread("---\ntitle: X\n\nportions: 4\n---\n\nMix.\n")).toEqual([]);
		expect(unread("## Prep\n\nMix.\n")).toEqual([]);
		expect(unread("---\ntitle: X\n# note\n")).toEqual([]);
		expect(unread("---\n---\n\nMix.\n")).toEqual([]);
	});

	it("ignores a '#' further down in the body", () => {
		expect(unread("---\ntitle: X\n---\n\n# not a key\n\nMix.\n")).toEqual([]);
	});
});
