import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { toMarkdown, toText } from "../src/index";

const SOURCE =
	"## Pâte\n\nMélanger @farine{200 g} et @sel{une pincée}.\n\nAjouter @poivre{selon le goût} puis @sel{1 g}.\n";

const build = (scaleFactor?: number) =>
	compile(getAST(SOURCE), scaleFactor ? { scaleFactor } : {});

describe("a quantity in words (`{une pincée}`)", () => {
	it("lists it in the compiled shopping list, as written", () => {
		const entries = build().shopping_list.filter(
			(e) => e.id === "sel" || e.id === "poivre",
		);
		expect(entries.flatMap((e) => e.variable_entries ?? [])).toEqual([
			"une pincée",
			"selon le goût",
		]);
	});

	it("shows it in the step, the section and the shopping list", () => {
		const md = toMarkdown(build());
		expect(md).toContain("**sel** (une pincée).");
		expect(md).toContain("**poivre** (selon le goût)");
		expect(md).toContain("- **sel** (une pincée + 1 g)");
		expect(md).toContain("- **sel** (une pincée)\n");
	});

	it("keeps it as written in a scaled recipe", () => {
		const text = toText(build(2));
		expect(text).toContain("une pincée");
		expect(text).toContain("selon le goût");
	});
});
