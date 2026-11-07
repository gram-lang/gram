import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";

// The words the recipe views write themselves (headings, "or", "optional"...)
// come from the dictionary, so they follow the language like the rest.

const SOURCE = `---
title: Tea
author: Someone
---

## Brew

Pour @water{250ml}|@milk{250ml} over @?tea{2g}, steep ~_{3min}. // hot
`;

const recipe = compile(getAST(SOURCE));

describe("the words of the recipe views follow the language", () => {
	it("writes English words in English", () => {
		const md = toMarkdown(recipe, { lang: "en" });
		expect(md).toContain("## 👨‍🍳 Instructions");
		expect(md).toContain("**Ingredients**:");
		expect(md).toContain("**water** (250 ml) or **milk** (250 ml)");
		expect(md).toContain("(optional)");
		expect(toPrintHTML(recipe, { lang: "en" })).toContain("<em>or</em>");
	});

	it("writes French words in French", () => {
		const md = toMarkdown(recipe, { lang: "fr" });
		expect(md).toContain("## 👨‍🍳 Étapes");
		expect(md).toContain("**Ingrédients** :");
		expect(md).toContain("**water** (250 ml) ou **milk** (250 ml)");
		expect(md).toContain("(optionnel)");
		expect(md).not.toMatch(/Instructions|Ingredients| or /);
		const print = toPrintHTML(recipe, { lang: "fr" });
		expect(print).toContain("<h2>Étapes</h2>");
		expect(print).toContain("<em>ou</em>");
		expect(print).toContain("<title>Tea</title>");
		expect(toHTML(recipe, { lang: "fr" })).toContain(
			'class="keyword">ou</span>',
		);
	});
});
