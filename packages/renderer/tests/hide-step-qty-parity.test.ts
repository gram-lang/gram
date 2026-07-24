import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";

// Regression test for the audit (2026-07-22, renderer finding I-4/P-1, Phase 9
// closure criterion): `hideStepQty` is a public RendererOptions flag documented
// as "ingredient quantities are omitted from step text", but only print.ts
// actually threaded it into the step-rendering context — html.ts and
// markdown.ts built their step context from `options` without ever looking at
// `options.hideStepQty`, so the flag was silently a no-op there.
//
// Note on scope: in "inline" mode (used for step content), the html-format
// strategy in element.ts never shows a *visible* plain quantity for a normal
// ingredient in the first place — it only ever appears in the `data-tooltip`
// attribute (unconditionally, regardless of `hideIngredientQty`). So the only
// backend where this bug had an observable effect on typical recipes is
// markdown, where the quantity is normally inlined as visible text. The
// html.ts fix is still correct (matches print.ts's existing wiring and keeps
// the option from silently diverging again if/when the html-format inline
// strategy changes), it's just not independently observable today.

describe("hideStepQty parity across backends", () => {
	const source = "## Section\n\nMix @flour{200g} with @water{100ml}.\n";
	const compiled = compile(getAST(source));

	// The numbered step line is the last line before the trailing blank line —
	// isolate it so shopping-list/mise-en-place occurrences of the same
	// quantity text (which hideStepQty must NOT touch) can't mask a regression.
	function stepLine(md: string): string {
		return md.trimEnd().split("\n").at(-1) ?? "";
	}

	it("markdown: hides the plaintext quantity in step text when set", () => {
		const shown = toMarkdown(compiled);
		const hidden = toMarkdown(compiled, { hideStepQty: true });

		expect(stepLine(shown)).toBe(
			"1. Mix **flour** (200 g) with **water** (100 ml).",
		);
		expect(stepLine(hidden)).toBe("1. Mix **flour** with **water**.");
	});

	it("markdown: still shows the quantity in the section ingredients list", () => {
		const hidden = toMarkdown(compiled, { hideStepQty: true });

		expect(hidden).toContain("**Ingredients**");
		expect(hidden).toContain("(200 g)");
	});

	it("html/print: accept the option without throwing, quantity stays available via tooltip", () => {
		// html-format "inline" mode surfaces the quantity through data-tooltip
		// regardless of hideStepQty (by design — it's a hover affordance, not
		// visible step text); this just documents that today's behavior, and
		// confirms both backends now read the same option consistently.
		const html = toHTML(compiled, { hideStepQty: true });
		const print = toPrintHTML(compiled, { hideStepQty: true });

		expect(html).toContain('data-tooltip="200 g"');
		expect(print).toContain('data-tooltip="200 g"');
	});
});
