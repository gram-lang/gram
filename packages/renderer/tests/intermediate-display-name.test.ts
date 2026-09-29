import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown } from "../src/index";

// A module-scoped intermediate keeps its qualified name as internal identity
// (`section.intermediate_preparation`, declaration `name`) while the registry
// carries the label the author wrote. Rendering must use the label.
function compileScoped() {
	const ast = getAST(
		"## Marinate ->&tofu$marinated\n\nSlice @tofu{200g} ->&tofu$pressed.\n",
	);
	const section = ast.children.find((c) => c.type === "Section") as {
		intermediateDecl: { displayName?: string };
		children: { children?: { type: string; displayName?: string }[] }[];
	};
	section.intermediateDecl.displayName = "marinated";
	for (const step of section.children) {
		for (const c of step.children ?? []) {
			if (c.type === "IntermediateDecl") c.displayName = "pressed";
		}
	}
	return compile(ast);
}

describe("scoped intermediate labels", () => {
	it("shows the label in the HTML section badge and declaration", () => {
		const html = toHTML(compileScoped());
		expect(html).toContain("marinated");
		expect(html).toContain("pressed");
		expect(html).not.toContain("tofu$");
	});

	it("shows the label in Markdown", () => {
		expect(toMarkdown(compileScoped())).not.toContain("tofu$");
	});
});
