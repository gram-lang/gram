import { describe, expect, it } from "bun:test";
import { compile, FRONTMATTER_KEYS } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { toHTML, toPrintHTML } from "../src/index";

// The byline lists the frontmatter keys Gram does not know as custom
// metadata, every key of `FRONTMATTER_KEYS` being Gram's own. `language` is
// one of them (the page's `lang` carries it): it is never shown there as a
// "language: fr" entry of the author's.
function recipe(frontmatter: string) {
	return compile(getAST(`---\n${frontmatter}\n---\n\n[Mix] @flour{200g}.\n`));
}

function customEntries(html: string): string[] {
	return [
		...html.matchAll(
			/<span class="byline-custom"><span class="label">([^<]*):<\/span>/g,
		),
	].map((m) => m[1] ?? "");
}

describe("byline custom metadata", () => {
	it("does not show the recipe's language as custom metadata", () => {
		const data = recipe("title: Pain\nlanguage: fr");
		expect(customEntries(toHTML(data))).not.toContain("language");
		expect(customEntries(toPrintHTML(data))).not.toContain("language");
	});

	it("still shows a key Gram does not know", () => {
		const data = recipe("title: Pain\nlanguage: fr\ndifficulty: easy");
		expect(customEntries(toHTML(data))).toEqual(["difficulty"]);
	});

	it("never lists a key of the registry, deprecated ones included", () => {
		const lines = FRONTMATTER_KEYS.map((def) => def.example).join("\n");
		expect(customEntries(toHTML(recipe(lines)))).toEqual([]);
	});
});

describe("byline last update", () => {
	const data = recipe("title: Pain\nlastUpdated: 2026-11-26");

	it("shows lastUpdated with its words, in the reader's language", () => {
		expect(toHTML(data, { lang: "en" })).toContain(
			'<span class="byline-updated">Updated 2026-11-26</span>',
		);
		expect(toHTML(data, { lang: "fr" })).toContain(
			'<span class="byline-updated">Mis à jour le 2026-11-26</span>',
		);
	});

	it("no longer shows it as a raw custom entry", () => {
		expect(customEntries(toHTML(data))).toEqual([]);
	});
});
