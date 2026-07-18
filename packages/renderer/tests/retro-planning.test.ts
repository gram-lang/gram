import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";

const compileRecipe = (header: string) =>
	compile(getAST(`## ${header}\nStep.\n`));

describe("retro-planning badge rendering", () => {
	it("shows the raw annotation in the HTML badge for a valid duration", () => {
		const html = toHTML(compileRecipe("Dough ~{-2h}"));
		expect(html).toContain("section-meta-retroplanning");
		expect(html).toContain("-2h");
	});

	it("round-trips a valid duration back into ~{...} markdown", () => {
		const md = toMarkdown(compileRecipe("Dough ~{-2h}"));
		expect(md).toContain("### Dough ~{-2h}");
	});

	it("shows the raw annotation parenthetically in print HTML", () => {
		const html = toPrintHTML(compileRecipe("Dough ~{-2h}"));
		expect(html).toContain("(-2h)");
	});

	it("still displays free-text retro-planning as a degraded badge (raw fallback) instead of crashing", () => {
		const html = toHTML(compileRecipe("Dough ~{la veille}"));
		expect(html).toContain("section-meta-retroplanning");
		expect(html).toContain("la veille");
	});

	it("round-trips degraded free text back into ~{...} markdown", () => {
		const md = toMarkdown(compileRecipe("Dough ~{la veille}"));
		expect(md).toContain("### Dough ~{la veille}");
	});
});
