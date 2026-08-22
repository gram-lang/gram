import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

// Regression tests for §C.4 of the module-imports RFC
// (.notes/plan-ajout-imports-recettes.md): `compile()` never resolves module
// files itself (that's `@gram-lang/modules`, running before compile() and
// producing a composed AST with an empty `imports` array). So whenever
// `compile()` is handed an AST with a non-empty `imports` — a standalone
// file in the playground, `gram check` on a file with no host project, an
// LSP document mid-edit — every `@use` binding is still registered as an
// intermediate. Without this, every `&binding` used in the body would raise
// its own UNDEFINED_REFERENCE on top of the one real problem.

describe("compiling a file with unresolved imports", () => {
	it("reports one MODULE_NOT_FOUND per import instead of cascading UNDEFINED_REFERENCE", () => {
		const source = `@use "./bases/pate.gram" as &pate

## Montage

[Foncer] avec &pate{250g} et &pate{50g}.
`;
		const result = compile(getAST(source));

		const codes = result.warnings.map((w) => w.code);
		expect(codes).toEqual(["MODULE_NOT_FOUND"]);
		expect(result.warnings[0]?.message).toContain("./bases/pate.gram");
	});

	it("registers every destructured binding so none of them trips UNDEFINED_REFERENCE", () => {
		const source = `@use "./bases/oeufs.gram" as { &blancs, &jaunes }

## Meringue

[Monter] &blancs{100g} en neige avec &jaunes{50g} de côté.
`;
		const result = compile(getAST(source));

		const codes = result.warnings.map((w) => w.code);
		expect(codes).toEqual(["MODULE_NOT_FOUND"]);
	});

	it("flags a host section that redeclares an already-imported name as a scope conflict", () => {
		const source = `@use "./bases/pate.gram" as &pate

## Pate ->&pate

Mix @flour{200g}.
`;
		const result = compile(getAST(source));

		const codes = result.warnings.map((w) => w.code);
		expect(codes).toContain("MODULE_NOT_FOUND");
		expect(codes).toContain("SCOPE_CONFLICT");
	});

	it("emits no warnings at all for a document without any @use directive", () => {
		const source = `## Section\n\nMix @flour{200g}.\n`;
		const result = compile(getAST(source));
		expect(result.warnings ?? []).toEqual([]);
	});
});
