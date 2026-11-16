import { describe, expect, it } from "bun:test";
import grammar from "../syntaxes/gram.tmLanguage.json";
import { ASTNodeType, getAST } from "../src/index";

// The children of the only step of a one-step recipe.
// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
function stepChildren(src: string): any[] {
	const ast = getAST(`## T\n\n${src}\n`);
	// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
	return (ast.children[0] as any).children[0].children;
}

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const temperatures = (src: string): any[] =>
	stepChildren(src).filter((c) => c.type === ASTNodeType.Temperature);

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const texts = (src: string): string[] =>
	stepChildren(src)
		.filter((c) => c.type === ASTNodeType.Text)
		.map((c) => c.value);

describe("a note glued to a temperature", () => {
	it("is read on an exact temperature", () => {
		const [t] = temperatures("Cuire à ^{160°C}(chaleur tournante).");
		expect(t.value.value).toBe(160);
		expect(t.unit).toBe("°C");
		expect(t.note).toBe("chaleur tournante");
		expect(texts("Cuire à ^{160°C}(chaleur tournante).")).toEqual([
			"Cuire à ",
			".",
		]);
	});

	it("is read on a named temperature", () => {
		const [t] = temperatures("^four{180°C}(gril)");
		expect(t.name).toBe("four");
		expect(t.note).toBe("gril");
	});

	it("is read on a temperature in words", () => {
		const [t] = temperatures("^{vif}(à couvert)");
		expect(t.text).toBe("vif");
		expect(t.note).toBe("à couvert");
	});

	it("spans the whole location of the element", () => {
		const src = "^{160°C}(chaleur tournante)";
		const [t] = temperatures(src);
		expect(t.loc.end - t.loc.start).toBe(src.length);
	});

	it("is not a note when a space comes before the parenthesis", () => {
		const src = "Cuire à ^{180°C} (four préchauffé).";
		const [t] = temperatures(src);
		expect("note" in t).toBe(false);
		expect(texts(src).join("")).toContain("(four préchauffé).");
	});

	it("is left out when empty", () => {
		const [t] = temperatures("^{160°C}()");
		expect("note" in t).toBe(false);
	});

	it("is left out of a temperature without one", () => {
		const [t] = temperatures("^{180°C}");
		expect(Object.keys(t).sort()).toEqual([
			"loc",
			"name",
			"type",
			"unit",
			"value",
		]);
	});

	it("stops at the end of the line: an unclosed parenthesis is prose", () => {
		const ast = getAST(
			"## T\n\nCuire à ^{180°C}(environ 20 min\n\nServir (chaud).\n",
		);
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		const [first, second] = (ast.children[0] as any).children;
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		const temp = first.children.find((c: any) => c.type === "Temperature");
		expect("note" in temp).toBe(false);
		expect(second.type).toBe("Step");
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		expect(second.children.map((c: any) => c.value).join("")).toBe(
			"Servir (chaud).",
		);
	});

	it("keeps the spaced forms of the name as before", () => {
		const [spaced] = temperatures("^ {180°C}");
		expect(spaced.name).toBeNull();
		expect(spaced.value.value).toBe(180);
		const [named] = temperatures("^four {180°C}(gril)");
		expect(named.name).toBe("four");
		expect(named.note).toBe("gril");
	});
});

describe("TextMate: a temperature's note", () => {
	const end = new RegExp(grammar.repository.temperatures.end);

	it("captures a glued note as a preparation", () => {
		const m = end.exec("}(chaleur tournante).");
		expect(m?.[2]).toBe("chaleur tournante");
		expect(grammar.repository.temperatures.endCaptures["2"].name).toBe(
			"string.other.preparation.gram",
		);
	});

	it("leaves a spaced or an unclosed parenthesis alone", () => {
		expect(end.exec("} (four préchauffé)")?.[0]).toBe("}");
		expect(end.exec("}(environ 20 min")?.[0]).toBe("}");
	});
});
