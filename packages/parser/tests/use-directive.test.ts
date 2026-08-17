import { describe, it, expect } from "bun:test";
import { getAST, GramParseError, isImportDecl } from "../src/index";

// Coverage for the `@use` import-declaration syntax (module-imports RFC,
// .notes/plan-ajout-imports-recettes.md, Phase A). The grammar constrains the
// whole `@use` block between the frontmatter and the content (`UseBlock` in
// grammar.ohm), so none of this collides with an ingredient literally named
// "use" appearing later in a step.

describe("@use directive parsing", () => {
	it("parses a default binding", () => {
		const ast = getAST('@use "./bases/pate.gram" as &pate\n\nstep\n');
		expect(ast.imports).toHaveLength(1);
		const decl = ast.imports[0];
		expect(decl?.specifier).toBe("./bases/pate.gram");
		expect(decl?.mode).toBe("inline");
		expect(decl?.bindings).toEqual([
			{ exported: "default", local: "pate", loc: expect.anything() },
		]);
	});

	it("parses destructured, named bindings", () => {
		const ast = getAST(
			'@use "./bases/oeufs.gram" as { &blancs, &jaunes }\n\nstep\n',
		);
		const decl = ast.imports[0];
		expect(decl?.bindings.map((b) => [b.exported, b.local])).toEqual([
			["blancs", "blancs"],
			["jaunes", "jaunes"],
		]);
	});

	it("parses a renamed binding inside a destructured import", () => {
		const ast = getAST(
			'@use "./base.gram" as { &paton as &paton-brisee }\n\nstep\n',
		);
		const decl = ast.imports[0];
		expect(decl?.bindings).toEqual([
			{ exported: "paton", local: "paton-brisee", loc: expect.anything() },
		]);
	});

	it("parses the prepared opt-out modifier", () => {
		const ast = getAST(
			'@use "std:fonds/bouillon-legumes" as &bouillon prepared\n\nstep\n',
		);
		expect(ast.imports[0]?.mode).toBe("prepared");
	});

	it("parses multiple imports in a row", () => {
		const ast = getAST(
			'@use "./a.gram" as &a\n@use "./b.gram" as &b\n\nstep\n',
		);
		expect(ast.imports.map((d) => d.specifier)).toEqual([
			"./a.gram",
			"./b.gram",
		]);
	});

	it("tolerates a comment between two @use directives without breaking the block", () => {
		const ast = getAST(
			'@use "./a.gram" as &a\n// disabled for now\n@use "./b.gram" as &b\n\nstep\n',
		);
		expect(ast.imports.map((d) => d.specifier)).toEqual([
			"./a.gram",
			"./b.gram",
		]);
		// The comment is consumed by the import block, not left dangling as a
		// step-level child.
		expect(ast.children.map((c) => c.type)).toEqual(["Step"]);
	});

	it("defaults imports to an empty array when the document has none", () => {
		const ast = getAST("## Section\nMix @flour{200g}.\n");
		expect(ast.imports).toEqual([]);
	});

	it("does not swallow a leading comment when the document has no @use directive", () => {
		// Regression guard: `UseBlock` must require a real `@use` to open, or a
		// leading comment on an import-free document would silently vanish from
		// `children` instead of surfacing as a Comment node like before.
		const ast = getAST("// leading comment\n## Section\nMix @flour{200g}.\n");
		expect(ast.imports).toEqual([]);
		expect(ast.children.map((c) => c.type)).toEqual(["Comment", "Section"]);
	});

	it("isImportDecl narrows an ImportDecl node", () => {
		const ast = getAST('@use "./a.gram" as &a\n\nstep\n');
		const decl = ast.imports[0];
		expect(decl && isImportDecl(decl)).toBe(true);
	});

	it("rejects an @use directive placed after the first step", () => {
		expect(() => getAST('## S\n\nstep one\n\n@use "./b.gram" as &b\n')).toThrow(
			GramParseError,
		);
	});

	it("still parses a bare ingredient literally named 'use'", () => {
		const ast = getAST("## S\n\nMix @use{200g}.\n");
		const step = ast.children[0];
		if (!("children" in step)) throw new Error("expected a Section");
		const stepBlock = step.children[0];
		if (!("children" in stepBlock)) throw new Error("expected a Step");
		const ingredient = stepBlock.children.find(
			(c) => c.type === "Ingredient",
		) as { name?: string } | undefined;
		expect(ingredient?.name).toBe("use");
	});
});
