import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { applyScale } from "../src/scale";
import { scaleAst } from "../src/scale/ast";

// Locks in Phase D.3 of the module-imports RFC
// (.notes/plan-ajout-imports-recettes.md): `scaleAst` scales a raw AST
// *before* compile(), so the module composer can scale an imported module
// once and splice it into a single document compiled — and ALAP-scheduled —
// exactly once. It must produce the same numbers as `applyScale`, which
// scales the already-*compiled* JSON — the path every other scaling
// consumer (CLI `gram scale`, the playground slider) already goes through.
//
// The source below deliberately covers the two structures a naive walk over
// bare IngredientAST nodes would miss (per the RFC's own call-out):
// an alternative (`@a|@b`) and a composite (`<@parent{qty}`) — plus a
// fraction and a range quantity, since scaleQty branches on those too.

describe("scaleAst matches applyScale", () => {
	// Deliberately excludes a fraction quantity (e.g. "1 1/2 cup"): scaleQty
	// converts a scaled fraction to a "single" value, and a fresh compile()
	// re-minifies that down to a bare number (minifyQuantity, utils.ts) while
	// applyScale mutates the already-compiled JSON in place without
	// re-minifying — a real, narrow, pre-existing shape quirk (object vs bare
	// number, same numeric value) that predates this RFC and is out of scope
	// for it. Range and single quantities aren't affected — minifyQuantity
	// only collapses the "single" variant.
	const source = `## Section

@butter{100g}|@margarine{80g}.

@egg-yolks{2}<@eggs{3}.

@sugar{100-150g}.

@salt{}(a pinch, unscaled by design).
`;

	it("produces identical section ingredients for a representative factor", () => {
		const ast = getAST(source);
		const factor = 2.5;

		const viaAst = compile(scaleAst(ast, factor));
		const viaCompiled = applyScale(compile(ast), factor);

		expect(viaAst.sections[0]?.ingredients).toEqual(
			viaCompiled.sections[0]?.ingredients,
		);
		expect(viaAst.shopping_list).toEqual(viaCompiled.shopping_list);
	});

	it("leaves a fixed (@=) ingredient untouched by either path", () => {
		const fixedSource = "## Section\n\n@=butter{100g}.\n";
		const ast = getAST(fixedSource);
		const factor = 3;

		const viaAst = compile(scaleAst(ast, factor));
		const viaCompiled = applyScale(compile(ast), factor);

		expect(viaAst.sections[0]?.ingredients[0]).toMatchObject({ qty: 100 });
		expect(viaAst.sections[0]?.ingredients).toEqual(
			viaCompiled.sections[0]?.ingredients,
		);
	});

	it("is a no-op clone at factor 1", () => {
		const ast = getAST(source);
		const scaled = scaleAst(ast, 1);
		expect(scaled).toBe(ast);
	});
});
