import { describe, expect, it } from "bun:test";
import { applyPreferredFixes, buildLineIndex } from "../../src/lint";
import { applyFix, lintCode, lintText, URI } from "./lint-helpers";

// A file edited on Windows (CRLF) or with old Mac line endings (CR) is the
// same recipe as its LF version: `gram check --fix` keeps its line endings,
// leaves no orphan `\r`, and a second pass has nothing left to do. The
// sources are built in code: no CRLF file is committed (no .gitattributes,
// and `core.autocrlf` would rewrite it on a Windows checkout).
const crlf = (lf: string) => lf.replace(/\n/g, "\r\n");
const cr = (lf: string) => lf.replace(/\n/g, "\r");

/** One pass of `gram check --fix` limited to `code`. */
function fixCode(code: string, text: string): string {
	return applyPreferredFixes(text, URI, lintCode(code, text)).text;
}

describe.each([
	["CRLF", crlf],
	["CR", cr],
])("preferred fixes on %s line endings", (_name, eol) => {
	const cases: [code: string, lf: string, fixedLf: string][] = [
		[
			// The removal takes the whole line, its line break included.
			"DEPRECATED_FRONTMATTER_KEY",
			"---\ntitle: T\nservings: 4\nportions: 4\n---\n\nMix @a{1}.\n",
			"---\ntitle: T\nportions: 4\n---\n\nMix @a{1}.\n",
		],
		[
			"DEPRECATED_FRONTMATTER_KEY",
			"---\ntitle: T\nservings: 4\n---\n\nMix @a{1}.\n",
			"---\ntitle: T\nportions: 4\n---\n\nMix @a{1}.\n",
		],
		[
			"SPACED_COMPOSITE",
			"---\ntitle: T\n---\n\nZest @lemon zest{1} < @lemon{2} finely.\n",
			"---\ntitle: T\n---\n\nZest @lemon zest{1}<@lemon{2} finely.\n",
		],
		[
			"INVALID_DURATION",
			"---\ntitle: T\n---\n\n## Pasta\n\nBoil ~pasta{15%min}.\n",
			"---\ntitle: T\n---\n\n## Pasta\n\nBoil ~pasta{15 min}.\n",
		],
		[
			"MERGED_STEP_LINE",
			"---\ntitle: T\n---\n\nMix @a{1}.\n[Bake] it.\n",
			"---\ntitle: T\n---\n\nMix @a{1}.\n\n[Bake] it.\n",
		],
	];

	it.each(
		cases,
	)("%s keeps the file's line endings and is idempotent", (code, lf, fixedLf) => {
		const fixedFromLf = fixCode(code, lf);
		// The LF fix is the reference the other line endings must match.
		expect(fixedFromLf).toBe(fixedLf);
		const fixed = fixCode(code, eol(lf));
		expect(fixed).toBe(eol(fixedLf));
		expect(lintCode(code, fixed)).toEqual([]);
		expect(fixCode(code, fixed)).toBe(fixed);
	});

	it("writes the line break a fix inserts in the file's own line ending", () => {
		// MISSING_TITLE's fix (not a preferred one) inserts a whole line.
		const text = eol("---\nportions: 4\n---\n\nMix @a{1}.\n");
		const [d] = lintCode("MISSING_TITLE", text);
		expect(applyFix(text, d!.fixes![0]!)).toBe(
			eol("---\ntitle: \nportions: 4\n---\n\nMix @a{1}.\n"),
		);
	});

	it("lints like the LF version, at the same places", () => {
		const lf = "---\ntitle: T\n---\n\nMix @a{1}.\n[Bake] it.\n";
		const codes = (text: string) =>
			lintText(text)
				.map((d) => d.code)
				.sort();
		expect(codes(eol(lf))).toEqual(codes(lf));
		const [d] = lintCode("MERGED_STEP_LINE", eol(lf));
		expect(eol(lf).slice(d!.loc!.start, d!.loc!.end)).toBe("[Bake] it.");
	});
});

describe("line endings found by the fuzz invariant", () => {
	it("blanks a CRLF frontmatter the scanner does not read as a block", () => {
		// The fallback pattern only knew `\n`: `@'` became a lost ingredient.
		expect(lintCode("LOST_INGREDIENT", "---\r\n://@'\r\n---")).toEqual([]);
		expect(lintCode("LOST_INGREDIENT", "---\n://@'\n---")).toEqual([]);
	});

	it("writes a fix's line break like the one before it, in a file that mixes them", () => {
		// A `\n` right after the lone `\r` would join it into one `\r\n`.
		const text = "\n->&r\ru";
		const fixed = fixCode("MERGED_STEP_LINE", text);
		expect(fixed).toBe("\n->&r\r\ru");
		expect(lintCode("MERGED_STEP_LINE", fixed)).toEqual([]);
	});
});

describe("buildLineIndex", () => {
	it("counts a line after each \\n, \\r\\n and lone \\r, as the LSP does", () => {
		expect(buildLineIndex("a\nb")).toEqual([0, 2]);
		expect(buildLineIndex("a\r\nb")).toEqual([0, 3]);
		expect(buildLineIndex("a\rb\r\nc\nd")).toEqual([0, 2, 5, 7]);
	});
});
