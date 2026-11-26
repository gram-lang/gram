import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { applyFix, lintCode, spanOf } from "./lint-helpers";

const TITLE = "---\ntitle: T\n---\n\n";
const merged = (text: string) => lintCode("MERGED_STEP_LINE", text);

/** Applies the preferred fix of the first diagnostic, then checks it holds. */
function fixOnce(text: string): string {
	const [d] = merged(text);
	const fix = d!.fixes!.find((f) => f.isPreferred)!;
	expect(fix.title).toBe("Insert a blank line");
	const fixed = applyFix(text, fix);
	expect(() => getAST(fixed)).not.toThrow();
	return fixed;
}

describe("MERGED_STEP_LINE", () => {
	it("flags a '[Action]' line right under a step, and the fix makes it the next step's action", () => {
		const text = `${TITLE}Mix @flour{500 g}.\n[Bake] in the oven.\n`;
		const [d] = merged(text);
		expect(spanOf(text, d!)).toBe("[Bake] in the oven.");
		expect(d!.severity).toBe("info");
		expect(d!.data).toEqual({ reason: "action" });
		const fixed = fixOnce(text);
		expect(fixed).toBe(`${TITLE}Mix @flour{500 g}.\n\n[Bake] in the oven.\n`);
		expect(merged(fixed)).toEqual([]);
		const steps = getAST(fixed).children;
		expect(steps).toHaveLength(2);
		expect((steps[1] as { action: string }).action).toBe("Bake");
	});

	it("flags a '##' line under a step, which made the section vanish", () => {
		const text = `${TITLE}Mélanger @farine{500 g}.\n## Cuisson\n\nEnfourner.\n`;
		const [d] = merged(text);
		expect(spanOf(text, d!)).toBe("## Cuisson");
		expect(d!.data).toEqual({ reason: "header" });
		const fixed = fixOnce(text);
		expect(merged(fixed)).toEqual([]);
		expect(getAST(fixed).children.some((c) => c.type === "Section")).toBe(true);
	});

	it("flags the line after one ending with '->&name'", () => {
		const text = `${TITLE}## Pâte\n\nMélanger @farine{500 g} ->&pâte\nLaisser reposer la &pâte.\n`;
		const [d] = merged(text);
		expect(spanOf(text, d!)).toBe("Laisser reposer la &pâte.");
		expect(d!.data).toEqual({ reason: "intermediate" });
		expect(d!.message).toContain("'->&pâte'");
		expect(merged(fixOnce(text))).toEqual([]);
	});

	it("keeps the file's CRLF line breaks in the fix", () => {
		const text = "Mix @a{1}.\r\n[Bake] it.\r\n";
		expect(fixOnce(text)).toBe("Mix @a{1}.\r\n\r\n[Bake] it.\r\n");
	});

	it("does not flag a plain line break inside a step (the official example)", () => {
		expect(merged(`${TITLE}A step,\nthe same step.\n`)).toEqual([]);
		expect(
			merged(
				`${TITLE}Faire fondre le @beurre{50 g},\npuis ajouter la @farine{50 g}.\n`,
			),
		).toEqual([]);
	});

	it("does not flag the line under a section header, which is read as a step", () => {
		expect(merged("## Dough\nMix @a{1}.\n\nKnead.\n")).toEqual([]);
		expect(merged("## Dough ->&dough\nMix @a{1}.\n")).toEqual([]);
	});

	it("does not flag '[' or '##' in the middle of a line, nor a '->&' that does not end it", () => {
		expect(merged(`${TITLE}Mix @a{1} [gently]\nthen ## times.\n`)).toEqual([]);
		expect(merged(`${TITLE}Mix @a{1} ->&dough then\nrest &dough.\n`)).toEqual(
			[],
		);
	});

	it("does not flag a block comment, nor a frontmatter the parser could not read", () => {
		expect(merged(`${TITLE}Mix @a{1}. /* note\n[Bake] later */\n`)).toEqual([]);
		expect(
			merged("---\ntitle: X\n# note\n## not a header\n---\n\nMix.\n"),
		).toEqual([]);
	});

	it("is cut by a '// gram-ignore' above the step", () => {
		expect(
			merged(
				`${TITLE}// gram-ignore MERGED_STEP_LINE\nMix @a{1}.\n[Bake] it.\n`,
			),
		).toEqual([]);
	});
});
