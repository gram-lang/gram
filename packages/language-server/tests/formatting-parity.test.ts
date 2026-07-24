import { describe, it, expect } from "bun:test";
import { formatGram } from "@gram-lang/format";
import { provideFormatting } from "../src/features/formatting";
import { parseDocument } from "../src/document-state";

// Regression/parity test for the audit (2026-07-22, cli finding B-4,
// language-server finding B4/P5, Phase 3bis): `gram format` (CLI) and
// "format on save" (LSP) used to be two independent implementations with
// disjoint rule sets — a recipe formatted by one and reopened in the other
// could still show further changes, defeating the point of a formatter.
// Both now call the same `@gram-lang/format` under the hood; this test pins
// that they still agree, so a future change that special-cases one call site
// shows up here immediately instead of silently reintroducing the fork.

describe("gram format / format-on-save parity", () => {
	const messy =
		"---\ntitle: Crepes\nauthor: Jean@Example.com\n---\n##Prep  \nAdd @Flour {500.0g} and @Egg{ 1.50 }.  \n\n\n\n\n##Bake\nSet oven to ~temp{180 °C}. ->&dough {}\nSeparate @egg yolks{3} < @eggs{3}.\n";

	it("CLI's formatGram and the LSP's provideFormatting produce the same output", () => {
		const { content } = formatGram(messy);

		const state = parseDocument(messy, {}, 1);
		const edits = provideFormatting(state);

		expect(edits).toHaveLength(1);
		expect(edits[0]?.newText).toBe(content);
	});

	it("agree that already-formatted content needs no edits", () => {
		const { content: formatted } = formatGram(messy);

		const state = parseDocument(formatted, {}, 1);
		const edits = provideFormatting(state);

		expect(edits).toEqual([]);
	});
});
