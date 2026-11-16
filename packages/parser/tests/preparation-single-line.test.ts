import { describe, expect, it } from "bun:test";
import { ASTNodeType, getAST } from "../src/index";

// A preparation ends on its line: an unclosed `(` used to run to the next `)`
// of the recipe, over blank lines and section headers, and swallowed them.

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const sections = (src: string): any[] => getAST(src).children as any[];

// The elements of the only step of a one-step recipe.
// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const elements = (src: string): any[] =>
	sections(`## T\n\n${src}\n`)[0].children[0].children;

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const text = (nodes: any[]): string =>
	nodes
		.filter((c) => c.type === ASTNodeType.Text)
		.map((c) => c.value)
		.join("");

describe("a preparation stays on its line", () => {
	it("keeps the steps and sections after an unclosed parenthesis", () => {
		const src =
			"## A\n\nMix @flour{200g}(sifted and\n\nBake at ^{180°C}.\n\n## B\n\nServe (hot).\n";
		const [a, b] = sections(src);
		expect(a.children).toHaveLength(2);
		const flour = a.children[0].children.find(
			// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
			(c: any) => c.type === ASTNodeType.Ingredient,
		);
		expect(flour.name).toBe("flour");
		expect(flour.preparation).toBeNull();
		expect(text(a.children[0].children)).toContain("(sifted and");
		expect(b.title).toBe("B");
		expect(text(b.children[0].children)).toBe("Serve (hot).");
	});

	it("leaves the unclosed parenthesis of a bare ingredient in the text", () => {
		const nodes = elements("Add @salt(fine");
		const salt = nodes.find((c) => c.type === ASTNodeType.Ingredient);
		expect(salt.name).toBe("salt");
		expect(salt.preparation).toBeNull();
		expect(text(nodes)).toContain("(fine");
	});

	it("does the same for cookware and a composite parent", () => {
		const pan = elements("Heat a #pan{1}(large").find(
			(c) => c.type === ASTNodeType.Cookware,
		);
		expect(pan.preparation).toBeNull();
		const zest = elements("Grate @zest{1}<@lemon{1}(organic").find(
			(c) => c.type === ASTNodeType.Ingredient,
		);
		expect(zest.composite.parent).toBe("lemon");
		expect(text(elements("Grate @zest{1}<@lemon{1}(organic"))).toContain(
			"(organic",
		);
		expect(zest.composite.preparation).toBeNull();
	});

	it("reads a preparation closed on its line as before", () => {
		const [flour] = elements("@flour{200g}(sifted, twice)");
		expect(flour.preparation).toBe("sifted, twice");
		const [pan] = elements("#pan{1}(20 cm)");
		expect(pan.preparation).toBe("20 cm");
		const [zest] = elements("@zest{1}<@lemon{1}(organic)");
		expect(zest.composite.preparation).toBe("organic");
	});
});
