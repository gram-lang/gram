import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";

// Safety net for the Chantier 4 DRY refactor (audit): full-output snapshots of
// a representative recipe (alternatives, composite-free but with intermediate
// references, adjacent timer/temperature/punctuation tokens exercising the
// inline spacing logic shared — soon literally shared — across the three
// formatters). If a refactor changes visible output, these fail loudly instead
// of silently.

const source = readFileSync(
	join(import.meta.dir, "fixtures", "sample.gram"),
	"utf-8",
);
const compiled = compile(getAST(source));

describe("renderer output snapshots", () => {
	it("toHTML output is stable", () => {
		expect(toHTML(compiled)).toMatchSnapshot();
	});

	it("toMarkdown output is stable", () => {
		expect(toMarkdown(compiled)).toMatchSnapshot();
	});

	it("toPrintHTML output is stable", () => {
		expect(toPrintHTML(compiled)).toMatchSnapshot();
	});
});

describe("inline step-token spacing (the logic duplicated across formatters)", () => {
	it("does not add a space before trailing punctuation after a token (HTML)", () => {
		const src = "## Section\nMix @flour{200g}, then rest.\n";
		const html = toHTML(compile(getAST(src)));
		// "flour" is followed by "," in the source — no extra space should be injected.
		expect(html).not.toMatch(/flour<\/span>\s+,/);
	});

	it("adds a space between two adjacent tokens with no punctuation between them (Markdown)", () => {
		const src = "## Section\nPour &batter{} @flour{50g}.\n";
		const md = toMarkdown(compile(getAST(src)));
		// Two consecutive tokens glued in the source must not render glued together.
		expect(md).not.toMatch(/batter\)\*\*@?flour/);
	});

	it("does not add a space before trailing punctuation after a token (print)", () => {
		const src = "## Section\nMix @flour{200g}, then rest.\n";
		const html = toPrintHTML(compile(getAST(src)));
		expect(html).not.toMatch(/flour<\/span>\s+,/);
	});
});
