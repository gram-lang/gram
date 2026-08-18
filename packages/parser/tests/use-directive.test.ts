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
		expect(decl?.retroPlanning).toBeNull();
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

	it("parses a bare binding followed by a braced multi-word binding", () => {
		const ast = getAST(
			'@use "./base.gram" as { &detrempe, &beurre manie{} }\n\nstep\n',
		);
		const decl = ast.imports[0];
		expect(decl?.bindings.map((b) => [b.exported, b.local])).toEqual([
			["detrempe", "detrempe"],
			["beurre manie", "beurre manie"],
		]);
	});

	it("parses two braced multi-word bindings", () => {
		const ast = getAST(
			'@use "./base.gram" as { &detrempe{}, &beurre manie{} }\n\nstep\n',
		);
		const decl = ast.imports[0];
		expect(decl?.bindings.map((b) => [b.exported, b.local])).toEqual([
			["detrempe", "detrempe"],
			["beurre manie", "beurre manie"],
		]);
	});

	it("parses a braced multi-word binding followed by a bare binding", () => {
		const ast = getAST(
			'@use "./base.gram" as { &beurre manie{}, &detrempe }\n\nstep\n',
		);
		const decl = ast.imports[0];
		expect(decl?.bindings.map((b) => [b.exported, b.local])).toEqual([
			["beurre manie", "beurre manie"],
			["detrempe", "detrempe"],
		]);
	});

	it("parses a bare-to-braced rename mixed with a bare binding", () => {
		const ast = getAST(
			'@use "./base.gram" as { &a as &mon a{}, &b }\n\nstep\n',
		);
		const decl = ast.imports[0];
		expect(decl?.bindings.map((b) => [b.exported, b.local])).toEqual([
			["a", "mon a"],
			["b", "b"],
		]);
	});

	it("parses a braced-to-bare rename inside a destructured import", () => {
		const ast = getAST(
			'@use "./base.gram" as { &water dough{} as &detrempe }\n\nstep\n',
		);
		const decl = ast.imports[0];
		expect(decl?.bindings.map((b) => [b.exported, b.local])).toEqual([
			["water dough", "detrempe"],
		]);
	});

	it("parses @use-level retro-planning", () => {
		const ast = getAST(
			'@use "./bases/levain.gram" as &levain ~{-2d}\n\nstep\n',
		);
		expect(ast.imports[0]?.retroPlanning).toEqual({
			raw: "-2d",
			sign: -1,
			value: 2,
			unit: "d",
		});
	});

	it("parses retro-planning glued directly to a bare binding name, no space", () => {
		const ast = getAST('@use "./bases/levain.gram" as &levain~{-2d}\n\nstep\n');
		const decl = ast.imports[0];
		expect(decl?.bindings).toEqual([
			{ exported: "default", local: "levain", loc: expect.anything() },
		]);
		expect(decl?.retroPlanning?.raw).toBe("-2d");
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
