import { describe, expect, it } from "bun:test";
import { ASTNodeType, getAST } from "../src/index";

// A word made only of element sigils (`@ # ~ ^ &`) is no name: the element
// falls back to text, like `@` or `#` alone, instead of registering a tool
// or an ingredient called `#` with a hashed id (#221). And a reference's
// name starts right after its `&`: the `&` of prose (`Rock & roll.`) is
// text, not a reference to the next word (#227).

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const elements = (src: string): any[] =>
	// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
	(getAST(src).children as any[]).flatMap((block) => block.children ?? []);

const textOf = (src: string): string =>
	elements(src)
		.map((node) => {
			expect(node.type).toBe(ASTNodeType.Text);
			return node.value;
		})
		.join("");

describe("a name made only of sigils (#221)", () => {
	for (const src of [
		"Mix ## well.",
		"Mix #~ well.",
		"Mix #-~ well.",
		"Mix @@ well.",
		"Mix @# well.",
		"Mix @^ well.",
		"Mix && well.",
		"Mix &@ well.",
		"Mix @@{1 g} well.",
		"###",
	]) {
		it(`reads ${JSON.stringify(src)} as text`, () => {
			expect(textOf(src)).toBe(src);
		});
	}

	it("reads a composite parent or a declaration made of sigils as text", () => {
		const [ingredient, ...rest] = elements("@a<@@ well.");
		expect(ingredient).toMatchObject({ type: "Ingredient", name: "a" });
		expect(ingredient.composite).toBeNull();
		expect(rest.every((n) => n.type === ASTNodeType.Text)).toBe(true);
		expect(textOf("Mix ->&& here.")).toBe("Mix ->&& here.");
	});

	it("keeps the element after a run of sigils", () => {
		expect(elements("Mix #~{} well.")[2].type).toBe(ASTNodeType.Timer);
		const nodes = elements("Mix @~{10 min} now.");
		expect(nodes.map((n) => n.type)).toEqual(["Text", "Text", "Timer", "Text"]);
	});

	for (const [src, type, name] of [
		["Use a #C#-shaped pan.", "Cookware", "C#-shaped"],
		["Mix @#5 well.", "Ingredient", "#5"],
		["Mix @a## well.", "Ingredient", "a##"],
		["Mix @@salt well.", "Ingredient", "@salt"],
		["Mix @é well.", "Ingredient", "é"],
		["Mix #&pan well.", "Cookware", "pan"],
		["Mix @&dough.", "Ingredient", "dough"],
		["Mix &dough.", "Reference", "dough"],
	] as const) {
		it(`still reads ${JSON.stringify(src)} as ${type} "${name}"`, () => {
			expect(elements(src).find((n) => n.type === type)?.name).toBe(name);
		});
	}
});

describe("an `&` followed by a blank (#227)", () => {
	for (const src of [
		"Rock & roll.",
		"Salt & pepper{}.",
		"Salt &\tpepper{1 g}.",
		"Salt & pepper{1 g/l}.",
	]) {
		it(`reads ${JSON.stringify(src)} as text`, () => {
			expect(textOf(src)).toBe(src);
		});
	}

	it("still reads a reference glued to its `&`", () => {
		expect(elements("Add &dough{200 g}.")[1]).toMatchObject({
			type: "Reference",
			name: "dough",
		});
	});
});
