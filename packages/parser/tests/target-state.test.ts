import { describe, expect, it } from "bun:test";
import grammar from "../syntaxes/gram.tmLanguage.json";
import {
	ASTNodeType,
	GramParseError,
	getAST,
	isCheckpoint,
} from "../src/index";

// The children of the only step of a one-step recipe.
// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
function stepChildren(src: string): any[] {
	const ast = getAST(`## T\n\n${src}\n`);
	// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
	return (ast.children[0] as any).children[0].children;
}

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const checkpoints = (src: string): any[] =>
	stepChildren(src).filter(isCheckpoint);

const texts = (src: string): string[] =>
	stepChildren(src)
		.filter((c) => c.type === ASTNodeType.Text)
		.map((c) => c.value);

// The type and name of each element of a step, its text left out.
const elements = (src: string): string[] =>
	stepChildren(src)
		.filter((c) => c.type !== ASTNodeType.Text)
		.map((c) => `${c.type}:${c.name ?? c.state ?? ""}`);

function parseError(src: string): GramParseError {
	try {
		getAST(`## T\n\n${src}\n`);
	} catch (e) {
		if (e instanceof GramParseError) return e;
		throw e;
	}
	throw new Error(`expected a parse error for ${JSON.stringify(src)}`);
}

describe("a target state", () => {
	it("is read with the words of the prose left around it", () => {
		const src = "Cuire jusqu'à ={la nappe}.";
		const [c] = checkpoints(src);
		expect(c).toEqual({
			type: ASTNodeType.Checkpoint,
			state: "la nappe",
			loc: c.loc,
		});
		expect(texts(src)).toEqual(["Cuire jusqu'à ", "."]);
	});

	it("keeps its state as written, trimmed", () => {
		const [c] = checkpoints("Fouetter until ={  ribbon stage, pale & thick }");
		expect(c.state).toBe("ribbon stage, pale & thick");
	});

	it("reads a note glued to its closing brace", () => {
		const src =
			"Cuire jusqu'à ={la nappe}(la crème nappe le dos de la cuillère).";
		const [c] = checkpoints(src);
		expect(c.state).toBe("la nappe");
		expect(c.note).toBe("la crème nappe le dos de la cuillère");
		expect(texts(src)).toEqual(["Cuire jusqu'à ", "."]);
	});

	it("spans the whole location of the element", () => {
		const src = "={la nappe}(test)";
		const [c] = checkpoints(src);
		expect(c.loc.end - c.loc.start).toBe(src.length);
	});

	it("reads several in a step, next to other elements", () => {
		expect(
			elements(
				"Cuire à ^{82°C}(à cœur) jusqu'à ={la nappe} puis ={tiède} ->&crème anglaise{}",
			),
		).toEqual([
			"Temperature:",
			"Checkpoint:la nappe",
			"Checkpoint:tiède",
			"IntermediateDecl:crème anglaise",
		]);
	});

	it("is not a note when a space comes before the parenthesis", () => {
		const src = "Fouetter jusqu'au ={ruban} (environ 5 min).";
		const [c] = checkpoints(src);
		expect("note" in c).toBe(false);
		expect(texts(src).join("")).toContain("(environ 5 min).");
	});

	it("leaves an empty note out", () => {
		const [c] = checkpoints("={la nappe}()");
		expect("note" in c).toBe(false);
	});

	it("stops its note at the end of the line: an unclosed parenthesis is prose", () => {
		const ast = getAST(
			"## T\n\nCuire jusqu'à ={la nappe}(environ 5 min\n\nServir (chaud).\n",
		);
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		const [first, second] = (ast.children[0] as any).children;
		const c = first.children.find(isCheckpoint);
		expect("note" in c).toBe(false);
		// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
		expect(second.children.map((x: any) => x.value).join("")).toBe(
			"Servir (chaud).",
		);
	});
});

describe("a malformed target state", () => {
	it("is an error when empty", () => {
		const e = parseError("Cuire jusqu'à ={}.");
		expect(e.message).toContain("Empty target state '={}'");
		expect(e.message).toContain("e.g. ={ribbon stage}");
		expect(e.offset).toBe("## T\n\nCuire jusqu'à ".length);
	});

	it("is an error with only spaces", () => {
		expect(parseError("={  }(note)").message).toContain(
			"Empty target state '={  }'",
		);
	});

	it("is an error when unclosed on its line", () => {
		expect(parseError("Cuire jusqu'à ={la nappe").message).toContain(
			"Unclosed target state '={la nappe' (missing '}')",
		);
		expect(parseError("Cuire jusqu'à ={la nappe\n\nServir.").message).toContain(
			"Unclosed target state",
		);
	});
});

// A name with no braces runs up to the next `{`: before 1.5.0 it read
// `@salt until ={taste}` as an ingredient "salt until =" of unit "taste".
describe("a target state after an element with no braces", () => {
	it.each([
		["Saler avec @sel jusqu'à ={goût}.", ["Ingredient:sel"]],
		["Cuire dans #casserole jusqu'à ={nappe}.", ["Cookware:casserole"]],
		["Ajouter &pâte jusqu'à ={lisse}.", ["Reference:pâte"]],
		["Mélanger @sel={goût}.", ["Ingredient:sel"]],
		["Cuire ~5 min jusqu'à ={nappe}.", []],
		["Chauffer ^four jusqu'à ={chaud}.", []],
	])("ends the element before it: %s", (src, before) => {
		expect(elements(src)).toEqual([
			...before,
			`Checkpoint:${checkpoints(src)[0]?.state}`,
		]);
		expect(checkpoints(src)).toHaveLength(1);
	});

	it("keeps a quantity of its own: `@sel{10 g}` still reads as before", () => {
		expect(elements("@sel{10 g} jusqu'à ={goût}")).toEqual([
			"Ingredient:sel",
			"Checkpoint:goût",
		]);
	});
});

describe("an `=` that is not a target state", () => {
	it("leaves the fixed modifier alone", () => {
		const [ing] = stepChildren("Ajouter @=sel{10 g}.").filter(
			(c) => c.type === ASTNodeType.Ingredient,
		);
		expect(ing.name).toBe("sel");
		expect(ing.quantity.fixed).toBe(true);
	});

	it("leaves an `=` in the prose alone", () => {
		expect(texts("Ici a = b, et x =y.").join("")).toBe("Ici a = b, et x =y.");
		expect(checkpoints("Ici a = b.")).toHaveLength(0);
	});
});

describe("TextMate: a target state", () => {
	const rule = grammar.repository.checkpoints;
	const begin = new RegExp(rule.begin);
	const end = new RegExp(rule.end);

	it("is one of the elements", () => {
		expect(grammar.repository.elements.patterns).toContainEqual({
			include: "#checkpoints",
		});
	});

	it("starts at `={` only", () => {
		expect(begin.exec("jusqu'à ={nappe}")?.index).toBe(8);
		expect(begin.exec("a = b")).toBeNull();
	});

	it("captures a glued note as a preparation", () => {
		expect(end.exec("}(la cuillère est nappée).")?.[2]).toBe(
			"la cuillère est nappée",
		);
		expect(rule.endCaptures["2"].name).toBe("string.other.preparation.gram");
	});

	it("leaves a spaced or an unclosed parenthesis alone", () => {
		expect(end.exec("} (environ 5 min)")?.[0]).toBe("}");
		expect(end.exec("}(environ 5 min")?.[0]).toBe("}");
	});

	it("is not swallowed into the name of an element with no braces", () => {
		const [ingredient, bare] = grammar.repository.ingredients.patterns;
		expect(
			new RegExp(ingredient!.begin!).exec("@sel jusqu'à ={goût}"),
		).toBeNull();
		expect(new RegExp(bare!.match!).exec("@sel={goût}")?.[3]).toBe("sel");
		const [tool] = grammar.repository.cookware.patterns;
		expect(
			new RegExp(tool!.begin!).exec("#casserole jusqu'à ={nappe}"),
		).toBeNull();
		expect(new RegExp(ingredient!.begin!).exec("@sel{10 g}")?.[3]).toBe("sel");
	});
});
