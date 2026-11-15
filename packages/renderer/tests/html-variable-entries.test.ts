import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import type { IngredientData } from "@gram-lang/analyzer";
import { toHTML } from "../src/index";

const database = {
	milk: { name: "milk", physical: { density: 1.03 } },
} as unknown as Record<string, IngredientData>;

/** The quantity column of every kit line, in document order. */
function kitQuantities(html: string, name: string): string[] {
	const out: string[] = [];
	for (const line of html.split("\n")) {
		if (!line.includes(`data-name="${name}"`) || !line.includes("kit-qty"))
			continue;
		const qty = line.slice(line.indexOf('class="kit-qty">') + 16);
		out.push(
			qty
				.replace(/<[^>]+>/g, " ")
				.replace(/\s+/g, " ")
				.trim(),
		);
	}
	return out;
}

// The HTML view showed only the first quantity of an ingredient used in two
// units within a section: the other ones (`variable_entries`) were dropped,
// where Markdown and text show them all.
describe("HTML kit: every quantity of an ingredient", () => {
	it("joins the quantities in other units with +", () => {
		const html = toHTML(
			compile(getAST("## Dough\n\nMix @flour{100 g} and @flour{1 cup}.\n")),
		);
		expect(kitQuantities(html, "flour")).toContain("100 g + 1 cup");
	});

	it("keeps them next to a standardized mass", () => {
		const recipe = analyze(
			compile(getAST("## Custard\n\nWarm @milk{500 ml}, then @milk{1 cup}.\n")),
			database,
		).result;
		const section = kitQuantities(toHTML(recipe), "milk").find((q) =>
			q.includes("+"),
		);
		expect(section).toStartWith("500 ml + 1 cup");
	});
});
