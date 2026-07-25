import { describe, it, expect } from "bun:test";
import { getAST, ASTNodeType } from "../src/index";

// The audit (Phase 5) noted @gram-lang/parser — the foundation of the whole
// toolchain — had zero dedicated tests, only indirect coverage via kitchen's/
// analyzer's fixtures. These cover the grammar's basic constructs, one known
// hard-error path, and robustness against malformed/adversarial input (the
// language server parses arbitrary, possibly untrusted, .gram files on every
// keystroke — see Phase 3/4 — so a crash on bad input is a real concern).

// Digs out the first Ingredient node of a single-step, single-section recipe
// AST — shared by every composite-syntax test below, which all only care
// about that one node's `preparation`/`composite` fields.
function firstIngredient(ast: unknown): any {
	return (ast as any).children[0].children[0].children[0];
}

describe("basic constructs", () => {
	it("parses a minimal recipe with a title, section, and ingredient", () => {
		const ast = getAST(
			"---\ntitle: Pancakes\n---\n## Batter\nMix @flour{200g}.\n",
		);
		expect(ast.type).toBe(ASTNodeType.Recipe);
		expect(ast.meta.title).toBe("Pancakes");
		expect(ast.children.length).toBeGreaterThan(0);
	});

	it("parses a composite ingredient (<@parent)", () => {
		const ast = getAST("## Section\n@egg-yolks{3}<@eggs\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"Composite"');
	});

	it("parses a composite ingredient on a bare, single-word child with no {qty}", () => {
		// A single-word ingredient is normally allowed to drop its {qty} braces
		// entirely (e.g. bare `@salt`) — the composite operator must not be a
		// special exception to that rule.
		const ast = getAST("## Section\n@juice<@lemon{1}\n");
		const ing = firstIngredient(ast);
		expect(ing.name).toBe("juice");
		expect(ing.quantity).toBeNull();
		expect(ing.composite).toEqual(
			expect.objectContaining({ type: "Composite", parent: "lemon" }),
		);
	});

	it("attaches a bare child's () preparation when it precedes the composite operator", () => {
		const ast = getAST("## Section\n@juice(strained)<@lemon{1}\n");
		const ing = firstIngredient(ast);
		expect(ing.preparation).toBe("strained");
		expect(ing.composite).toEqual(
			expect.objectContaining({ type: "Composite", parent: "lemon" }),
		);
	});

	it("recognizes a () that follows the composite operator as the PARENT's own preparation", () => {
		// A () right after <@parent{qty} describes the parent (e.g. "the lemon,
		// cut in half"), independent of the child's own preparation (if any).
		const ast = getAST(
			"## Section\n@juice{150ml}<@lemon{1}(cut in half) into the pan.\n",
		);
		const ing = firstIngredient(ast);
		expect(ing.preparation).toBeNull();
		expect(ing.composite).toEqual(
			expect.objectContaining({
				type: "Composite",
				parent: "lemon",
				preparation: "cut in half",
			}),
		);
	});

	it("recognizes a () after a bare (no-quantity) composite parent as its preparation", () => {
		const ast = getAST(
			"## Section\n@juice<@lemon(cut in half) into the pan.\n",
		);
		const ing = firstIngredient(ast);
		expect(ing.composite).toEqual(
			expect.objectContaining({
				type: "Composite",
				parent: "lemon",
				quantity: null,
				preparation: "cut in half",
			}),
		);
	});

	it("keeps the child's own preparation and the parent's preparation independent", () => {
		// Correct field order for the child: quantity before preparation
		// (name alias? ingredientQuantity preparation? composite?), matching the
		// "full" ingredient form's existing rule — preparation before quantity
		// would not match and silently falls back to the bare alternative.
		const ast = getAST(
			"## Section\n@juice{150ml}(strained)<@lemon{1}(cut in half) into the pan.\n",
		);
		const ing = firstIngredient(ast);
		expect(ing.preparation).toBe("strained");
		expect(ing.composite).toEqual(
			expect.objectContaining({
				type: "Composite",
				parent: "lemon",
				preparation: "cut in half",
			}),
		);
	});

	it("parses an alternative ingredient group (a|b)", () => {
		const ast = getAST("## Section\nUse @butter{50g}|@oil{50ml}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"Alternative"');
	});

	it("parses a relative quantity (50%@other)", () => {
		const ast = getAST("## Section\nAdd @water{50%@&flour}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"RelativeQuantity"');
	});

	it("parses a timer and a temperature token", () => {
		const ast = getAST("## Section\nBake at ^{180C} for ~{20min}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"Timer"');
		expect(json).toContain('"Temperature"');
	});

	it("no longer recognizes ° as the Temperature sigil (^ replaced it, not aliased it)", () => {
		const ast = getAST("## Section\nBake at °{180C} for ~{20min}.\n");
		const json = JSON.stringify(ast);
		expect(json).not.toContain('"Temperature"');
	});

	it("parses a passive timer with the ~_ marker", () => {
		const ast = getAST("## Section\nProve the dough ~_{45min}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"isPassive":true');
	});

	it("parses an active timer as isPassive:false", () => {
		const ast = getAST("## Section\nWhisk for ~{2min}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"isPassive":false');
	});

	it("parses a mixed-fraction quantity (1 1/2)", () => {
		const ast = getAST("## Section\nAdd @flour{1 1/2 cups}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"value":1.5');
	});

	it("parses a Unicode fraction glyph quantity (½)", () => {
		const ast = getAST("## Section\nAdd @sugar{½ cup}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"value":0.5');
	});

	it("parses a mixed Unicode fraction glyph quantity (1½)", () => {
		const ast = getAST("## Section\nAdd @sugar{1½ cups}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"value":1.5');
	});

	it("averages a range built from mixed fractions correctly", () => {
		const ast = getAST("## Section\nAdd @flour{1 1/2-2 1/2 cups}.\n");
		const json = JSON.stringify(ast);
		expect(json).toContain('"value":2'); // avg of 1.5 and 2.5
	});
});

describe("trailing sentence punctuation on bare names", () => {
	// singleWordName previously stopped at "," ";" "!" "?" but not ".", so any
	// bare name at the end of an ordinary sentence (the single most common
	// case in natural recipe prose) absorbed the period into its own identity
	// — silently corrupting shopping-list aggregation and database lookups.

	it("does not absorb a trailing period into a bare ingredient name", () => {
		const ast = getAST("## Section\nAdd the @salt.\n");
		const ing = (ast as any).children[0].children[0].children[1];
		expect(ing.name).toBe("salt");
	});

	it("does not absorb a trailing period into a bare cookware name", () => {
		const ast = getAST("## Section\nUse the #pan.\n");
		const cw = (ast as any).children[0].children[0].children[1];
		expect(cw.type).toBe("Cookware");
		expect(cw.name).toBe("pan");
	});

	it("does not absorb a trailing period into a bare reference name", () => {
		const ast = getAST("## Section\n->&dough{}\nRoll the &dough.\n");
		const ref = (ast as any).children[0].children[0].children[3];
		expect(ref.type).toBe("Reference");
		expect(ref.name).toBe("dough");
	});

	it("does not absorb a trailing period into a bare composite parent name", () => {
		const ast = getAST("## Section\nX @juice<@lemon.\n");
		const ing = (ast as any).children[0].children[0].children[1];
		expect(ing.composite.parent).toBe("lemon");
	});
});

describe("bare @ingredient/#cookware names stop at a later element's sigil", () => {
	// `name` (used by simpleIngredient/simpleCookware's "full" alternative)
	// only excludes syntaxChar ({}()<|:) and newlines, not @ # ~ ^ -- so a bare
	// mention followed later on the same line by an unrelated {...} that
	// happens to close a valid quantity used to have its "full" alternative
	// win, swallowing everything in between (including the other element's
	// own sigil) into a single bogus name and losing that element entirely.
	// Fixed by switching to refName, the same fix already used for bare `&`
	// references (see refSigil).

	it("does not swallow a later timer into a bare ingredient reference", () => {
		const ast = getAST(
			"## Section\n\nAdd @chicken{4}.\n\nBrown the @&chicken for ~{3min}.\n",
		);
		const step = (ast as any).children[0].children[1];
		const ing = step.children.find((c: any) => c.type === "Ingredient");
		const timer = step.children.find((c: any) => c.type === "Timer");
		expect(ing.name).toBe("chicken");
		expect(timer).toBeDefined();
	});

	it("does not swallow a later temperature into a bare ingredient reference", () => {
		const ast = getAST(
			"## Section\n\nAdd @chicken{4}.\n\nBrown the @&chicken and rest ^{180C}.\n",
		);
		const step = (ast as any).children[0].children[1];
		const ing = step.children.find((c: any) => c.type === "Ingredient");
		const temp = step.children.find((c: any) => c.type === "Temperature");
		expect(ing.name).toBe("chicken");
		expect(temp).toBeDefined();
	});

	it("does not swallow a later cookware mention into a bare ingredient reference", () => {
		const ast = getAST(
			"## Section\n\nAdd @chicken{4}.\n\nBrown the @&chicken then add #pan{1}.\n",
		);
		const step = (ast as any).children[0].children[1];
		const ing = step.children.find((c: any) => c.type === "Ingredient");
		const cw = step.children.find((c: any) => c.type === "Cookware");
		expect(ing.name).toBe("chicken");
		expect(cw?.name).toBe("pan");
	});

	it("does not swallow a later ingredient into a bare cookware mention", () => {
		const ast = getAST("## Section\n\nHeat the #pan then add @flour{2}.\n");
		const step = (ast as any).children[0].children[0];
		const cw = step.children.find((c: any) => c.type === "Cookware");
		const ing = step.children.find((c: any) => c.type === "Ingredient");
		expect(cw.name).toBe("pan");
		expect(ing?.name).toBe("flour");
	});
});

describe("section retro-planning", () => {
	// The grammar rule itself stays a permissive "any text until }" capture —
	// tightening it was tried and rejected (see plan notes): Ohm's absoluteQuantity
	// swallows free text like "la veille" as a bogus unit anyway, and inputs that
	// genuinely fail to match make the whole header vanish silently into the
	// previous section's body rather than raising a clean error. So strictness is
	// enforced downstream (kitchen), and the parser's job here is just to
	// mechanically split sign/value/unit out of whatever text was captured.

	it("extracts a negative signed duration", () => {
		const ast = getAST("## Dough ~{-2h}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toEqual({
			raw: "-2h",
			sign: -1,
			value: 2,
			unit: "h",
		});
	});

	it("extracts a positive (unsigned) duration", () => {
		const ast = getAST("## Dough ~{2d}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toEqual({
			raw: "2d",
			sign: 1,
			value: 2,
			unit: "d",
		});
	});

	it("extracts value with no unit (kitchen will flag as MISSING_UNIT)", () => {
		const ast = getAST("## Dough ~{5}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toEqual({
			raw: "5",
			sign: 1,
			value: 5,
			unit: null,
		});
	});

	it("extracts an unrecognized unit token as-is (kitchen resolves/validates it)", () => {
		const ast = getAST("## Dough ~{5xyz}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toEqual({
			raw: "5xyz",
			sign: 1,
			value: 5,
			unit: "xyz",
		});
	});

	it("leaves free text with no value/unit extracted (kitchen will flag as invalid)", () => {
		const ast = getAST("## Dough ~{la veille}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toEqual({
			raw: "la veille",
			sign: 1,
			value: null,
			unit: null,
		});
	});

	it("extracts retroPlanning identically regardless of its order relative to ->&name", () => {
		// Regression test: headerExtension_decl (retro AFTER ->&name) used to call
		// .toAST() on an already-converted plain object (getOpt() already resolves
		// it), throwing "r.toAST is not a function" for every recipe written in
		// this order. Pre-existing bug, unrelated to retro-planning strictness,
		// caught only because this order had no test coverage at all before.
		const retroFirst = getAST("## Dough ~{-2h} ->&dough\nStep.\n")
			.children[0] as any;
		const declFirst = getAST("## Dough ->&dough ~{-2h}\nStep.\n")
			.children[0] as any;

		const expected = { raw: "-2h", sign: -1, value: 2, unit: "h" };
		expect(retroFirst.retroPlanning).toEqual(expected);
		expect(declFirst.retroPlanning).toEqual(expected);
		expect(retroFirst.intermediateDecl.name).toBe("dough");
		expect(declFirst.intermediateDecl.name).toBe("dough");
	});
});

describe("known hard error", () => {
	it("throws a descriptive syntax error for a space before the composite `<` sigil", () => {
		expect(() => getAST("## Section\n@ <@parent\n")).toThrow(/composite/i);
	});

	// A multi-word name always needs {} (the grammar's own rule: quantity is
	// mandatory unless the name is a single word) — there's no reliable way to
	// detect this in general (nothing distinguishes a continued name from
	// ordinary prose that happens to follow). But inside an Alternative, `|`
	// has no other legitimate meaning in the grammar (verified: it's excluded
	// from name/singleWordName via syntaxChar, and used nowhere else), so an
	// orphan `|` that reaches this far is unambiguously a broken alternative
	// caused by exactly this mistake — worth a hard, actionable error instead
	// of silently losing the alternative relationship and swallowing the `|`.
	it("throws a descriptive syntax error for an unbraced multi-word name before '|' in an ingredient alternative", () => {
		expect(() =>
			getAST("## Section\nX @egg substitute|@tofu and more.\n"),
		).toThrow(/alternative/i);
	});

	it("throws the same error for the same pattern in a cookware alternative", () => {
		expect(() => getAST("## Section\n#big pot|#small pot\n")).toThrow(
			/alternative/i,
		);
	});

	it("does not throw for a valid single-word ingredient alternative", () => {
		expect(() => getAST("## Section\nAdd @egg|@yogurt.\n")).not.toThrow();
	});

	it("does not throw for a valid braced multi-word ingredient alternative", () => {
		expect(() =>
			getAST("## Section\nAdd @egg substitute{2}|@tofu{100g}.\n"),
		).not.toThrow();
	});

	it("does not throw for '|' inside a comment or a preparation", () => {
		expect(() => getAST("## Section\n// a | b\nStep.\n")).not.toThrow();
		expect(() =>
			getAST("## Section\nAdd @salt{1}(a pinch | to taste).\n"),
		).not.toThrow();
	});
});

describe("robustness against malformed / adversarial input", () => {
	it("does not throw on an empty document", () => {
		expect(() => getAST("")).not.toThrow();
	});

	it("does not throw on control characters / binary garbage", () => {
		expect(() => getAST("\x00\x01\x02 binary garbage\n")).not.toThrow();
	});

	it("does not throw on an unterminated quantity brace", () => {
		expect(() => getAST("## Section\nMix @flour{200g\n")).not.toThrow();
	});

	it("does not throw on deeply repeated sigils with no content", () => {
		expect(() => getAST("@".repeat(500))).not.toThrow();
	});

	it("parses a large (100k char) document within a bounded time, guarding against catastrophic backtracking", () => {
		const big = `## Section\n${"Mix @flour{200g}. ".repeat(5000)}\n`;
		const start = performance.now();
		expect(() => getAST(big)).not.toThrow();
		expect(performance.now() - start).toBeLessThan(5000);
	});

	// Regression test for the audit (2026-07-22, §6.3/P-005): frontmatter is
	// merged key-by-key via `Object.assign(acc, { [key]: value })` (parser
	// src/index.ts). A `__proto__` key uses JS's computed-property-key
	// semantics (an own data property, not the prototype link) when produced,
	// but `Object.assign`'s plain `target[key] = value` assignment *does* hit
	// the inherited `Object.prototype.__proto__` accessor when writing it onto
	// the merge accumulator — the standard shape of a prototype-pollution bug.
	// It happens to be inert today only because frontmatter values are always
	// strings/string-arrays, and the `__proto__` accessor silently ignores a
	// non-object/non-null assignment — a fragile, accidental safety net (the
	// exact pattern the audit calls out repeatedly: "safe by construction
	// accident, not by design"), so this is pinned as an explicit regression.
	it("does not pollute Object.prototype via a `__proto__` frontmatter key", () => {
		const before = Object.getOwnPropertyNames(Object.prototype).length;

		const ast = getAST(
			"---\ntitle: Proto\n__proto__: polluted\n---\n## Section\nMix @flour{200g}.\n",
		);

		expect(Object.getOwnPropertyNames(Object.prototype).length).toBe(before);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		// "__proto__" is inherited by every plain object (an accessor on
		// Object.prototype), so `toHaveProperty` would always match it —
		// `Object.keys` (own enumerable keys only) is the correct check here.
		expect(Object.keys(ast.meta)).not.toContain("__proto__");
		expect(ast.meta).toEqual({ title: "Proto" });
	});
});
