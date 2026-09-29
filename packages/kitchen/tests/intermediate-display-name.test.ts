import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src";
import { intermediateLabel } from "../src/registry";

describe("intermediate display names", () => {
	it("registers the declared name as the label of a plain intermediate", () => {
		const result = compile(getAST("## Dough ->&dough\n\nMix @flour{200g}.\n"));
		expect(result.registry.ingredients.dough?.name).toBe("dough");
	});

	it("does not split a literal $ in an authored name", () => {
		const result = compile(getAST("## Mix ->&a$b\n\nMix @flour{200g}.\n"));
		const entry = Object.values(result.registry.ingredients).find(
			(e) => e.is_intermediate,
		);
		expect(entry?.name).toBe("a$b");
	});

	it("honours displayName set by module composition", () => {
		const ast = getAST("## Dough ->&tofu$dough\n\nMix @flour{200g}.\n");
		const decl = ast.children.find((c) => c.type === "Section") as {
			intermediateDecl: { displayName?: string };
		};
		decl.intermediateDecl.displayName = "dough";
		const result = compile(ast);
		expect(result.registry.ingredients["tofu-dough"]?.name).toBe("dough");
	});
});

describe("intermediateLabel", () => {
	const entry = { id: "tofu-dough", name: "dough", is_intermediate: true };

	it("resolves through a plain registry object or a Map", () => {
		expect(intermediateLabel({ "tofu-dough": entry }, "tofu$dough")).toBe(
			"dough",
		);
		expect(
			intermediateLabel(new Map([["tofu-dough", entry]]), "tofu$dough"),
		).toBe("dough");
	});

	it("falls back to the name when the registry has no entry", () => {
		expect(intermediateLabel({}, "tofu$dough")).toBe("tofu$dough");
	});
});
