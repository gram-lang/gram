import { describe, it, expect } from "bun:test";
import {
	getAST,
	ASTNodeType,
	isSection,
	isStep,
	isComment,
	isCompoundQuantity,
} from "../src/index";

// Regression tests for the audit (2026-07-22, parser finding I3): the AST
// types documented a shape the parser didn't actually produce, papered over
// by 24 `as XxxAST` casts in index.ts. These pin the real, previously-untyped
// behaviors that removing those casts forced into the open.

describe("RecipeAST.children is not always SectionAST[]", () => {
	it("places a Step directly under Recipe when the document has no section header", () => {
		const ast = getAST("Mix @flour{200g}.\n");
		expect(ast.children).toHaveLength(1);
		expect(ast.children[0]?.type).toBe(ASTNodeType.Step);
	});

	it("places leading top-level blocks before the first Section header", () => {
		const ast = getAST("// leading comment\n## Section\nMix @flour{200g}.\n");
		expect(ast.children.map((c) => c.type)).toEqual([
			ASTNodeType.Comment,
			ASTNodeType.Section,
		]);
	});
});

describe("CompositeAST carries loc, like every other AST node", () => {
	it("sets loc on a composite ingredient spanning the '<@...' syntax", () => {
		const source = "## Section\n@juice{150ml}<@lemon{1}(cut in half).\n";
		const ast = getAST(source);
		const step = ast.children[0];
		if (!isSection(step)) throw new Error("expected a Section");
		const stepBlock = step.children[0];
		if (!isStep(stepBlock)) throw new Error("expected a Step");
		const ingredient = stepBlock.children.find(
			(c) => c.type === ASTNodeType.Ingredient,
		) as { composite?: { loc?: { start: number; end: number } } } | undefined;

		expect(ingredient?.composite?.loc).toBeDefined();
		const loc = ingredient?.composite?.loc;
		expect(loc && source.slice(loc.start, loc.end)).toBe(
			"<@lemon{1}(cut in half)",
		);
	});
});

describe("Modifier reflects the real grammar sigils, not semantic names", () => {
	it("produces raw sigils ('?', '*', ...) for ingredient modifiers", () => {
		const ast = getAST("## Section\n@?*flour{1g}\n");
		const step = ast.children[0];
		if (!isSection(step)) throw new Error("expected a Section");
		const stepBlock = step.children[0];
		if (!isStep(stepBlock)) throw new Error("expected a Step");
		const ingredient = stepBlock.children[0] as { modifiers?: string[] };
		expect(ingredient.modifiers).toEqual(["?", "*"]);
	});
});

describe("guards narrow the widened ASTNode union correctly", () => {
	it("isSection/isStep/isComment correctly discriminate a mixed top-level children array", () => {
		const ast = getAST("// note\nMix @flour{200g}.\n");
		const [comment, step] = ast.children;
		expect(comment && isComment(comment)).toBe(true);
		expect(step && isStep(step)).toBe(true);
		expect(comment && isSection(comment)).toBe(false);
	});
});

describe("CompoundQuantityAST carries a loc per term", () => {
	it("points each term at its own text, its sign left out", () => {
		const source = "## Section\n\nMix @flour{1 cup - 2 tbsp}.\n";
		const ast = getAST(source);
		const section = ast.children[0];
		if (!isSection(section)) throw new Error("expected a Section");
		const step = section.children[0];
		if (!isStep(step)) throw new Error("expected a Step");
		const ingredient = step.children.find(
			(c) => c.type === ASTNodeType.Ingredient,
		);
		if (ingredient?.type !== ASTNodeType.Ingredient)
			throw new Error("expected an Ingredient");
		const quantity = ingredient.quantity;
		if (!isCompoundQuantity(quantity))
			throw new Error("expected a CompoundQuantity");
		const text = (loc?: { start: number; end: number }) =>
			loc ? source.slice(loc.start, loc.end) : undefined;
		expect(text(quantity.loc)).toBe("1 cup - 2 tbsp");
		expect(quantity.terms.map((t) => text(t.loc))).toEqual(["1 cup", "2 tbsp"]);
		expect(quantity.terms.map((t) => t.minus ?? false)).toEqual([false, true]);
	});
});
