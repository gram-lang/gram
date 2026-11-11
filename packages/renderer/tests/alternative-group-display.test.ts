import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown } from "../src/index";

function extractShoppingListBlock(html: string): string | undefined {
	return html.match(
		/<details class="[^"]*shopping-list[^"]*"[^>]*>[\s\S]*?<\/details>/,
	)?.[0];
}

function extractCookwareBlock(html: string): string | undefined {
	return (
		html.match(
			/<details class="[^"]*cookware[^"]*"[^>]*>[\s\S]*?<\/details>/,
		)?.[0] ??
		html.match(
			/<div class="mep-group">\s*<h5 class="mep-group-title">(?:Matériel|Cookware)<\/h5>[\s\S]*?<\/div>/,
		)?.[0]
	);
}

function extractSectionIngredientsBlock(html: string): string | undefined {
	return html.match(/<div class="section-ingredients">[\s\S]*?<\/div>/)?.[0];
}

// @egg{2}|@egg substitute{2}(vegan): an alternative group. Every context
// (shopping list, cookware, section/mise-en-place ingredient list) should
// join the options on one line with "or" rather than the old nested <ul>
// sub-list — and the section list should also carry each option's own
// preparation, the same way a regular (non-alternative) ingredient already
// shows its preparation there.
const source =
	"## Prep\n[Mix] the @egg{2}|@egg substitute{2}(vegan) and #pan|#skillet.\n";
const compiled = compile(getAST(source));

describe("alternative group display", () => {
	it("Markdown shopping list joins options on one line", () => {
		const md = toMarkdown(compiled);
		expect(md).toContain("- **egg** (2) or **egg substitute** (2)");
		expect(md).not.toContain("Alternative Group");
	});

	it("HTML shopping list joins options on one line, not a nested sub-list", () => {
		const block = extractShoppingListBlock(toHTML(compiled));
		expect(block).toContain(
			'<span class="alt-group"><span class="ingredient" data-name="egg">egg <span class="quantity">2</span></span> <span class="keyword">or</span> <span class="ingredient" data-name="egg substitute">egg substitute <span class="quantity">2</span></span></span>',
		);
		expect(block).not.toContain("<ul>\n        <li>");
	});

	it("Markdown cookware list joins options on one line", () => {
		const md = toMarkdown(compiled);
		expect(md).toContain("- *pan* or *skillet*");
	});

	it("HTML cookware list joins options on one line, not a nested sub-list", () => {
		const block = extractCookwareBlock(toHTML(compiled));
		expect(block).toContain(
			'<span class="alt-group"><span class="cookware" data-name="pan">pan</span> <span class="keyword">or</span> <span class="cookware" data-name="skillet">skillet</span></span>',
		);
	});

	it("a leaf (non-alternative) cookware item shows its count as ×N in the quantity column", () => {
		const source2 = "## Prep\n\nUse #pan{2} to cook.\n";
		const compiled2 = compile(getAST(source2));
		const block = extractCookwareBlock(toHTML(compiled2));
		expect(block).toContain(
			'<span class="kit-name cookware" data-name="pan">pan</span></span><span class="kit-qty"><span class="kit-mass">×2</span></span>',
		);
		expect(block).not.toContain("data-tooltip");
	});

	it("a single piece of cookware shows no count", () => {
		const block = extractCookwareBlock(
			toHTML(compile(getAST("## Prep\n\nUse #pan{1} to cook.\n"))),
		);
		expect(block).toContain(
			'<span class="kit-name cookware" data-name="pan">pan</span></span></span></label>',
		);
		expect(block).not.toContain("×");
	});

	it("Markdown section ingredients show the alternative group with each option's own preparation", () => {
		const md = toMarkdown(compiled);
		expect(md).toContain("- **egg** (2) or **egg substitute** (2) — vegan");
	});

	it("HTML section ingredients show the alternative group with each option's own preparation", () => {
		const block = extractSectionIngredientsBlock(toHTML(compiled));
		expect(block).toContain(
			'<span class="ingredient" data-name="egg substitute">egg substitute <span class="quantity">2</span> <span class="prep">&mdash; vegan</span></span>',
		);
	});

	it("HTML inline step text is unaffected — still uses the (alt) badge, not the joined form", () => {
		const html = toHTML(compiled);
		const stepsBlock = html.match(/<ol class="steps">[\s\S]*?<\/ol>/)?.[0];
		expect(stepsBlock).toContain('class="ingredient-alt-badge"');
		expect(stepsBlock).not.toContain(
			'<span class="ingredient" data-name="egg">egg <span class="quantity">2</span></span> <span class="keyword">or</span>',
		);
	});
});
