import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown, toText } from "../src/index";

// The parser keeps no whitespace after an element, so the views put the space
// back. Two elements in a row (`@flour{500 g} ~{1h}`) need one too, or the
// step reads "flour (500 g)1 h".
const compiled = compile(
	getAST(
		"## Dough\n\nKnead @flour{500 g} ~{1h}.\n\nPut @flour{1 kg} #bowl{} aside.\n\nAdd @salt{1 g}, then stir. // to taste\n",
	),
);

const plain = (s: string) =>
	s
		.replace(/<svg[\s\S]*?<\/svg> ?/g, "")
		.replace(/<[^>]+>/g, "")
		.replace(/[*_]/g, "")
		.replace(/⏲️ /g, "")
		.replace(/ /g, " ");

describe("two elements in a row are separated by a space", () => {
	for (const [name, render] of [
		["Markdown", () => toMarkdown(compiled)],
		["HTML", () => toHTML(compiled)],
		["text", () => toText(compiled, { color: false })],
	] as const) {
		it(name, () => {
			const out = plain(render());
			expect(out).toContain("flour (500 g) 1 h.");
			expect(out).toContain("flour (1 kg) bowl aside.");
			expect(out).toContain("salt (1 g), then stir");
		});
	}
});
