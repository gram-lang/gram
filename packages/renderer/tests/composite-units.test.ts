import { describe, expect, it } from "bun:test";
import { analyze } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { prepareViews, render, toHTML, toMarkdown } from "../src/index";

// A composite parent used in two units that do not add up (`100 g` and `2`)
// comes as two composite entries, one per unit, both `multiUnit` (since
// 1.5.2). Each view shows both, each with the parts drawn in its unit: none
// may keep only the first entry of the pair.
const source =
	"## Prep\n\nFondre @beurre{100 g}.\n\nAjouter @noisette{10 g}<@beurre{2}.\n";
const compiled = compile(getAST(source));

describe("a composite parent in two units", () => {
	it("Markdown lists both entries", () => {
		const md = toMarkdown(compiled);
		expect(md).toContain(
			"- **beurre** (2) **(Composite)**:\n  - **noisette** (10 g)\n",
		);
		expect(md).toContain(
			"- **beurre** (100 g) **(Composite)**:\n  - **Direct Use** (100 g)\n",
		);
	});

	it("HTML lists both entries", () => {
		const html = toHTML(compiled);
		const parents = [
			...html.matchAll(
				/<li class="kit-ingredient kit-composite">[\s\S]*?<span class="kit-mass">([^<]*)<\/span>/g,
			),
		].map((m) => m[1]);
		expect(parents).toEqual(["2", "100 g"]);
	});

	it("text lists both entries", () => {
		const data = analyze(compiled, {}).result;
		const out = render("recipe", prepareViews(data, {}), "text", {}) ?? "";
		expect(out).toMatch(/ {2}beurre +2, 10 g\n {4}↳ noisette +10 g\n/);
		expect(out).toMatch(/ {2}beurre +100 g\n {4}↳ Direct Use +100 g\n/);
	});
});
