import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";

// Both HTML and print HTML render the section ingredient list inside the same
// wrapper markup — factored out since every HTML/print assertion below needs it.
function extractSectionIngredientsBlock(html: string): string | undefined {
	return html.match(/<div class="section-ingredients">[\s\S]*?<\/div>/)?.[0];
}

// @jus{2cl}<@citron{1/2}: a composite child ("jus") of a parent ("citron").
// Section/mise-en-place ingredient lists should show "jus (citron)" so the
// parent stays traceable even when the child is written with a short name,
// while the shopping list (already parent-nested) and the inline step text
// (parent already visible via <@citron in the source) must stay unchanged.
const source = "## Prep\n[Squeeze] the @jus{2cl}<@citron{1/2} into the bowl.\n";
const compiled = compile(getAST(source));

describe("composite parent display in section/mise-en-place ingredient lists", () => {
	it("Markdown section ingredients show the parent next to the short child name", () => {
		const md = toMarkdown(compiled);
		expect(md).toContain("**jus** (citron) (2 cl)");
	});

	it("HTML section ingredients show the parent as visible text and a data attribute", () => {
		const sectionBlock = extractSectionIngredientsBlock(toHTML(compiled));
		expect(sectionBlock).toContain('data-parent="citron"');
		expect(sectionBlock).toContain(
			'<span class="composite-parent">(citron)</span>',
		);
	});

	it("Print HTML section ingredients also show the parent, despite print.ts never setting formatMode", () => {
		const sectionBlock = extractSectionIngredientsBlock(toPrintHTML(compiled));
		expect(sectionBlock).toContain(
			'<span class="composite-parent">(citron)</span>',
		);
	});

	it("Markdown shopping list keeps its existing nested composite structure, unaffected", () => {
		const md = toMarkdown(compiled);
		expect(md).toContain("**citron** (1/2) **(Composite)**:");
		expect(md).toContain("- **jus** (2 cl)");
		// The nested shopping-list child must not also gain a "(citron)" suffix.
		expect(md).not.toContain("**jus** (citron) (2 cl)\n  ");
	});

	it("inline step text still shows just the child name, with no parent suffix", () => {
		const md = toMarkdown(compiled);
		expect(md).toContain("the **jus** (2 cl) into the bowl.");
		expect(md).not.toContain("the **jus** (citron)");
	});
});

// @jus{2cl}<@citron{1/2}(coupé en deux): the PARENT also carries its own
// preparation, independent of any preparation the child might have. It should
// fold into the same section-list parenthetical as the parent name, and stay
// out of the shopping list and inline step text just like the parent name does.
const sourceWithParentPrep =
	"## Prep\n[Squeeze] the @jus{2cl}<@citron{1/2}(coupé en deux) into the bowl.\n";
const compiledWithParentPrep = compile(getAST(sourceWithParentPrep));

describe("composite parent preparation display in section/mise-en-place ingredient lists", () => {
	it("Markdown section ingredients fold the parent's preparation into the same parenthetical", () => {
		const md = toMarkdown(compiledWithParentPrep);
		expect(md).toContain("**jus** (citron, coupé en deux) (2 cl)");
	});

	it("HTML section ingredients show the combined label and a data-parent-preparation attribute", () => {
		const sectionBlock = extractSectionIngredientsBlock(
			toHTML(compiledWithParentPrep),
		);
		expect(sectionBlock).toContain('data-parent-preparation="coupé en deux"');
		expect(sectionBlock).toContain(
			'<span class="composite-parent">(citron, coupé en deux)</span>',
		);
	});

	it("Print HTML section ingredients also show the combined label", () => {
		const sectionBlock = extractSectionIngredientsBlock(
			toPrintHTML(compiledWithParentPrep),
		);
		expect(sectionBlock).toContain(
			'<span class="composite-parent">(citron, coupé en deux)</span>',
		);
	});

	it("the shopping list shows no trace of the parent's preparation", () => {
		const md = toMarkdown(compiledWithParentPrep);
		const shoppingListBlock = md.match(
			/## 🛒 Shopping List\n([\s\S]*?)\n## /,
		)?.[1];
		expect(shoppingListBlock).toContain("**citron** (1/2) **(Composite)**:");
		expect(shoppingListBlock).not.toContain("coupé en deux");
	});

	it("inline step text shows no trace of the parent's preparation either", () => {
		const md = toMarkdown(compiledWithParentPrep);
		expect(md).toContain("the **jus** (2 cl) into the bowl.");
	});
});
