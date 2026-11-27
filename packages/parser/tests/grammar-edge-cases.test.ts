import { describe, it, expect } from "bun:test";
import { getAST, ASTNodeType, GramParseError } from "../src/index";

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

	// Regression: `<@&parent` used to fall through to the `bare` branch, whose
	// `singleWordName` accepts "&" and stops at the first space. A multi-word
	// parent was therefore truncated into a phantom ingredient literally named
	// "&citron", which slugified to a *different* id than the real parent — the
	// shopping list silently listed the same lemon twice, with no warning.
	it("accepts an already-introduced composite parent (<@&parent) without keeping the sigil", () => {
		const ast = getAST("## Section\n@juice{1}<@&lemon{}\n");
		const ing = firstIngredient(ast);
		expect(ing.composite).toEqual(
			expect.objectContaining({ type: "Composite", parent: "lemon" }),
		);
	});

	it("keeps a MULTI-WORD <@&parent intact instead of truncating at the first space", () => {
		const ast = getAST("## Section\n@juice{1}<@&unwaxed lemon{}\n");
		const ing = firstIngredient(ast);
		// Both halves matter: the sigil must be gone AND the name must not be
		// cut down to "unwaxed".
		expect(ing.composite).toEqual(
			expect.objectContaining({ type: "Composite", parent: "unwaxed lemon" }),
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
		expect((ast.children[0] as any).retroPlanning).toMatchObject({
			raw: "-2h",
			sign: -1,
			value: 2,
			unit: "h",
		});
	});

	it("extracts a positive (unsigned) duration", () => {
		const ast = getAST("## Dough ~{2d}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toMatchObject({
			raw: "2d",
			sign: 1,
			value: 2,
			unit: "d",
		});
	});

	it("extracts value with no unit (kitchen will flag as MISSING_UNIT)", () => {
		const ast = getAST("## Dough ~{5}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toMatchObject({
			raw: "5",
			sign: 1,
			value: 5,
			unit: null,
		});
	});

	it("extracts an unrecognized unit token as-is (kitchen resolves/validates it)", () => {
		const ast = getAST("## Dough ~{5xyz}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toMatchObject({
			raw: "5xyz",
			sign: 1,
			value: 5,
			unit: "xyz",
		});
	});

	it("leaves free text with no value/unit extracted (kitchen will flag as invalid)", () => {
		const ast = getAST("## Dough ~{la veille}\nStep.\n");
		expect((ast.children[0] as any).retroPlanning).toMatchObject({
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
		expect(retroFirst.retroPlanning).toMatchObject(expected);
		expect(declFirst.retroPlanning).toMatchObject(expected);
		expect(retroFirst.intermediateDecl.name).toBe("dough");
		expect(declFirst.intermediateDecl.name).toBe("dough");
	});
});

describe("text left after a section header's anchor / intermediate", () => {
	// Before 1.4.1 any text after `~{...}` / `->&name` made the header rule fail:
	// the `##` line fell back to a step, so the section vanished silently, or its
	// `~{-10h}` anchor surfaced as a misleading "Invalid quantity for timer".
	function parseError(source: string): GramParseError {
		try {
			getAST(source);
		} catch (e) {
			expect(e).toBeInstanceOf(GramParseError);
			return e as GramParseError;
		}
		throw new Error("expected a GramParseError");
	}

	const MULTI_WORD =
		/Intermediate name 'rhubarbe laquée' .* ->&rhubarbe laquée\{\}/;

	it.each([
		["anchor first", "## Garniture ~{-10h} ->&rhubarbe laquée\n\nStep.\n", 21],
		["anchor last", "## Garniture ->&rhubarbe laquée ~{-10h}\n\nStep.\n", 13],
		["no anchor", "## Garniture ->&rhubarbe laquée\n\nStep.\n", 13],
		["end of file", "## Garniture ->&rhubarbe laquée", 13],
	])("asks for braces on a multi-word intermediate (%s)", (_label, source, offset) => {
		const err = parseError(source);
		expect(err.message).toMatch(MULTI_WORD);
		expect(err.offset).toBe(offset);
	});

	it.each([
		[
			"text after the anchor",
			"## Garniture ~{-10h} au frais\n\nStep.\n",
			"au frais",
		],
		["two intermediates", "## Garniture ->&a ->&b\n\nStep.\n", "->&b"],
	])("rejects any other leftover text (%s)", (_label, source, leftover) => {
		expect(parseError(source).message).toContain(
			`Unexpected text '${leftover}' in a section header`,
		);
	});

	it("still accepts braces, trailing spaces and either order", () => {
		for (const header of [
			"## Garniture ->&rhubarbe laquée{} ~{-10h}",
			"## Garniture ~{-10h} ->&rhubarbe laquée{}  ",
		]) {
			const section = getAST(`${header}\n\nStep.\n`).children[0] as any;
			expect(section.type).toBe(ASTNodeType.Section);
			expect(section.retroPlanning.raw).toBe("-10h");
			expect(section.intermediateDecl.name).toBe("rhubarbe laquée");
		}
	});

	it("keeps a header written on the last line, without a final newline", () => {
		const section = getAST("Step.\n\n## Mousse ->&mousse ~{-1d}").children.at(
			-1,
		) as any;
		expect(section.type).toBe(ASTNodeType.Section);
		expect(section.retroPlanning.raw).toBe("-1d");
		expect(section.intermediateDecl.name).toBe("mousse");
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

	it("reports an unterminated quantity brace as a structured parse error, not a crash", () => {
		expect(() => getAST("## Section\n\nMix @flour{200g\n")).toThrow(
			GramParseError,
		);
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

const firstIngredients = (src: string) => {
	const ast = getAST(`## T\n\n${src}\n`);
	const section = ast.children[0] as { children: { children: any[] }[] };
	return section.children[0].children.filter(
		(c) => c.type === ASTNodeType.Ingredient,
	);
};

describe("unit abbreviations with dots (issue #24)", () => {
	const variants = [
		["1/2 c.à.s", "c.à.s"],
		["1 c.à.c", "c.à.c"],
		["1 c. à s.", "c. à s."],
		["1 c.à.s.", "c.à.s."],
		["1 c.a.s", "c.a.s"],
		["1 càs", "càs"],
	] as const;

	for (const [qty, unit] of variants) {
		it(`parses {${qty}} keeping the multi-word name and the unit`, () => {
			const [ing] = firstIngredients(`@sucre roux{${qty}}`);
			expect(ing.name).toBe("sucre roux");
			expect(ing.quantity.unit).toBe(unit);
		});
	}

	it("keeps six distinct ingredients distinct", () => {
		const src = variants.map(([q], i) => `@sucre n${i}{${q}}`).join(" ");
		expect(firstIngredients(src).map((i) => i.name)).toEqual(
			variants.map((_, i) => `sucre n${i}`),
		);
	});

	it("still accepts dots in names and numbers", () => {
		expect(firstIngredients("@St.Môret{100g}")[0].name).toBe("St.Môret");
		expect(firstIngredients("@lait 1.5%{200ml}")[0].quantity.unit).toBe("ml");
		expect(firstIngredients("@huile d'olive{15g}")[0].name).toBe(
			"huile d'olive",
		);
		expect(firstIngredients("@eau{1.5-2l}")[0].quantity.unit).toBe("l");
		expect(firstIngredients("@lait{2 1/2 cup}")[0].quantity.unit).toBe("cup");
	});
});

describe("malformed quantity braces are errors, not silent drops (issue #24)", () => {
	const cases: [string, string, number][] = [
		["@sel{1 g/l}", "ingredient 'sel'", 4],
		["@sucre{2 càs", "missing '}'", 6],
		["@sucre{1. kg}", "ingredient 'sucre'", 6],
		["#casserole{grande}", "cookware 'casserole'", 10],
		["#casserole{2 l}", "cookware 'casserole'", 10],
		["@farine{200g}<@pâte{x/y}", "composite parent 'pâte'", 19],
		["&dough{1 /}", "reference 'dough'", 6],
		["~repos{10 min", "missing '}'", 6],
	];

	for (const [src, fragment, col] of cases) {
		it(`rejects ${src}`, () => {
			const text = `## T\n\n${src}\n`;
			try {
				getAST(text);
				throw new Error("expected a GramParseError");
			} catch (e) {
				expect(e).toBeInstanceOf(GramParseError);
				const err = e as GramParseError;
				expect(err.message).toContain(fragment);
				expect(err.offset).toBe(text.indexOf(src) + col);
			}
		});
	}

	it("keeps a temperature text quantity valid", () => {
		expect(() =>
			getAST("## T\n\nPréchauffer ^four{thermostat 6/7}\n"),
		).not.toThrow();
	});
});

describe("natural timers keep what was written in raw", () => {
	const timers = (src: string): any[] => {
		const ast = getAST(`## T\n\n${src}\n`);
		const section = ast.children[0] as { children: { children: any[] }[] };
		return section.children[0].children.filter(
			(c: any) => c.type === ASTNodeType.Timer,
		);
	};

	it("fills raw for a timer read as a quantity", () => {
		const [timer] = timers("Cuire ~{ 10 min }.");
		expect(timer.raw).toBe("10 min");
		expect(timer.quantity.unit).toBe("min");
	});

	it("keeps the quantity branch for 1h30, whose unit is h30", () => {
		const [timer] = timers("Cuire ~{1h30}.");
		expect(timer.raw).toBe("1h30");
		expect(timer.quantity.unit).toBe("h30");
	});

	it.each([
		["~{1:30 h}", "1:30 h"],
		["~{5'30\"}", "5'30\""],
		["~{1h + 30min}", "1h + 30min"],
		["~{1h30-2h}", "1h30-2h"],
		["~{1:30}", "1:30"],
		["~four{0:04:30}", "0:04:30"],
		["~_{45 min – 1 h}", "45 min – 1 h"],
		["~repos{1 /}", "1 /"],
	])("parses %s as text instead of failing", (src, raw) => {
		const [timer] = timers(`Cuire ${src}.`);
		expect(timer.raw).toBe(raw);
		expect(timer.quantity).toMatchObject({
			type: ASTNodeType.TextQuantity,
			value: raw,
		});
	});

	it("keeps the name and the passive marker on a text timer", () => {
		const [timer] = timers("Laisser lever ~_pousse{1:30 h}.");
		expect(timer.name).toBe("pousse");
		expect(timer.isPassive).toBe(true);
	});

	it("stops a text timer at the end of the line", () => {
		expect(() => getAST("## T\n\nCuire ~{1:30 h\nsuite}.\n")).toThrow(
			GramParseError,
		);
	});
});

describe("decimal comma", () => {
	// Every element of a step, in a one-step recipe.
	const elements = (src: string): any[] => {
		const ast = getAST(`## T\n\n${src}\n`);
		const section = ast.children[0] as { children: { children: any[] }[] };
		return section.children[0].children;
	};
	const ofType = (src: string, type: ASTNodeType) =>
		elements(src).filter((c) => c.type === type);

	it("reads a comma between two digits as a decimal in an ingredient", () => {
		const [ing] = firstIngredients("@farine{1,5 kg}");
		expect(ing.quantity.value).toEqual({
			type: "single",
			value: 1.5,
			text: "1,5",
		});
		expect(ing.quantity.unit).toBe("kg");
	});

	it("reads it in a range, a fraction and a number glued to its unit", () => {
		expect(firstIngredients("@eau{1,5-2,5 l}")[0].quantity.value.range).toEqual(
			{
				min: 1.5,
				max: 2.5,
			},
		);
		expect(firstIngredients("@sel{1,5/2 g}")[0].quantity.value.value).toBe(
			0.75,
		);
		expect(firstIngredients("@lait{0,5l}")[0].quantity.unit).toBe("l");
	});

	it("reads it in a relative quantity (12,5% is not 12%)", () => {
		const [ing] = firstIngredients("@eau{12,5% &pâte}");
		expect(ing.quantity.percent).toBe(12.5);
	});

	it("reads it in a timer, a temperature and a cookware count", () => {
		expect(
			ofType("Cuire ~{1,5 h}.", ASTNodeType.Timer)[0].quantity.value.value,
		).toBe(1.5);
		expect(
			ofType("Four ^{37,5 °C}.", ASTNodeType.Temperature)[0].value.value,
		).toBe(37.5);
		expect(
			ofType("Prendre #moules{1,5}.", ASTNodeType.Cookware)[0].quantity.value
				.value,
		).toBe(1.5);
	});

	it("reads it in a section anchor", () => {
		const ast = getAST("## Pâte ~{-1,5h}\n\nPétrir.\n");
		expect((ast.children[0] as any).retroPlanning).toMatchObject({
			raw: "-1,5h",
			sign: -1,
			value: 1.5,
			unit: "h",
		});
	});

	it("leaves commas of the prose alone", () => {
		const names = firstIngredients(
			"Mélanger @farine{1}, @sucre{2,5 g}, @sel et @oeufs{3}.",
		).map((i) => i.name);
		expect(names).toEqual(["farine", "sucre", "sel", "oeufs"]);
	});

	it("still rejects a comma that is not between two digits", () => {
		expect(() => getAST("## T\n\n@farine{1, 5 kg}.\n")).toThrow(GramParseError);
		expect(() => getAST("## T\n\n@farine{1,kg}.\n")).toThrow(GramParseError);
	});
});

describe("sums of quantities (since 1.5.0)", () => {
	const elements = (src: string): any[] => {
		const ast = getAST(`## T\n\n${src}\n`);
		const section = ast.children[0] as { children: { children: any[] }[] };
		return section.children[0].children.filter(
			(c: any) => c.type !== ASTNodeType.Text,
		);
	};
	const quantity = (src: string): any => elements(src)[0].quantity;
	const terms = (src: string) =>
		quantity(src).terms.map((t: any) => [
			t.minus ? "-" : "+",
			t.value?.text ?? null,
			t.unit,
		]);

	// [written, terms as [sign, number as written, unit]]
	const accepted: [string, [string, string | null, string | null][]][] = [
		[
			"{1 cup + 1 tbsp}",
			[
				["+", "1", "cup"],
				["+", "1", "tbsp"],
			],
		],
		[
			"{1 cup - 2 tbsp}",
			[
				["+", "1", "cup"],
				["-", "2", "tbsp"],
			],
		],
		[
			"{1 cup+20g}",
			[
				["+", "1", "cup"],
				["+", "20", "g"],
			],
		],
		[
			"{ 1 cup + 1-2 tbsp }",
			[
				["+", "1", "cup"],
				["+", "1-2", "tbsp"],
			],
		],
		[
			"{1 cup - 1 - 2 tbsp}",
			[
				["+", "1", "cup"],
				["-", "1 - 2", "tbsp"],
			],
		],
		[
			"{2 1/2 cups + 1½ tbsp - 1,5 tsp}",
			[
				["+", "2 1/2", "cups"],
				["+", "1½", "tbsp"],
				["-", "1,5", "tsp"],
			],
		],
		[
			"{1 + 1 cup}",
			[
				["+", "1", null],
				["+", "1", "cup"],
			],
		],
		[
			"{100g + 10%}",
			[
				["+", "100", "g"],
				["+", "10", "%"],
			],
		],
		[
			"{1 kg + 2 fl oz}",
			[
				["+", "1", "kg"],
				["+", "2", "fl oz"],
			],
		],
	];

	for (const [braces, expected] of accepted) {
		it(`reads @farine${braces} as a sum`, () => {
			const q = quantity(`@farine${braces}`);
			expect(q.type).toBe(ASTNodeType.CompoundQuantity);
			expect(terms(`@farine${braces}`)).toEqual(expected);
			expect(q.raw).toBe(braces.slice(1, -1).trim());
		});
	}

	it("keeps a plain quantity and a range as they were", () => {
		expect(quantity("@farine{200 g}").type).toBe(ASTNodeType.Quantity);
		const range = quantity("@farine{1 - 2 cups}");
		expect(range.type).toBe(ASTNodeType.Quantity);
		expect(range.value.range).toEqual({ min: 1, max: 2 });
		expect(range.unit).toBe("cups");
		expect(quantity("@farine{}").type).toBe(ASTNodeType.Quantity);
		expect(quantity("@farine{10% &pâte}").type).toBe(
			ASTNodeType.RelativeQuantity,
		);
	});

	it("marks a fixed sum with =", () => {
		const q = quantity("@=sel{1 tsp + 1 pinch}");
		expect(q.type).toBe(ASTNodeType.CompoundQuantity);
		expect(q.fixed).toBe(true);
		expect(quantity("@sel{1 tsp + 1 pinch}").fixed).toBe(false);
	});

	it("reads a sum on a composite parent and on a reference", () => {
		const [ing] = elements("@jus{1}<@citron{1 cup + 1 tbsp}");
		expect(ing.composite.quantity.type).toBe(ASTNodeType.CompoundQuantity);
		const [ref] = elements("&pâte{1 kg + 200 g}");
		expect(ref.type).toBe(ASTNodeType.Reference);
		expect(ref.quantity.type).toBe(ASTNodeType.CompoundQuantity);
		expect(ref.quantity.terms.map((t: any) => t.unit)).toEqual(["kg", "g"]);
	});

	it("leaves timers and temperatures as they were", () => {
		const [temperature] = elements("^{180°C + 20°C}");
		expect(temperature.type).toBe(ASTNodeType.Temperature);
		expect(temperature.text).toBe("180°C + 20°C");
		const [timer] = elements("~{1h + 30min}");
		expect(timer.quantity.type).toBe(ASTNodeType.TextQuantity);
		expect(timer.raw).toBe("1h + 30min");
	});

	it.each([
		["@sel{100 g + 10% &farine}", "ingredient 'sel'"],
		["@sel{100 g +}", "ingredient 'sel'"],
		["@sel{+ 100 g}", "ingredient 'sel'"],
		["@sel{1 cup ++ 1 tbsp}", "ingredient 'sel'"],
	])("still rejects %s", (src, fragment) => {
		expect(() => getAST(`## T\n\n${src}\n`)).toThrow(fragment);
	});
});

// #199: `formatGram("")` returns "\n", so an empty file must parse once
// formatted; and nothing but blank lines may follow a frontmatter or the
// last `@use`.
describe("blank lines with nothing after them", () => {
	for (const source of ["\n", "\n\n", " \n", "\r\n"]) {
		it(`parses ${JSON.stringify(source)} as an empty recipe`, () => {
			expect(getAST(source)).toMatchObject({ children: [], imports: [] });
		});
	}

	it("parses a frontmatter followed by a blank line", () => {
		const ast = getAST("---\ntitle: Bread\n---\n\n");
		expect(ast.meta).toEqual({ title: "Bread" });
		expect(ast.children).toEqual([]);
	});

	it("parses @use followed by a blank line", () => {
		const ast = getAST('@use "./dough.gram" as &dough\n\n');
		expect(ast.imports).toHaveLength(1);
		expect(ast.children).toEqual([]);
	});

	it("keeps the steps before trailing blank lines", () => {
		expect(getAST("Mix.\n\nBake.\n\n\n").children).toHaveLength(2);
	});
});

// #200: the parser and the formatter share one definition of a blank: a
// space or a tab, and a line break is LF, CRLF or a lone CR. A line holding
// only blanks ends a step; any other character (a no-break space, a
// mid-file U+FEFF) is text.
describe("blanks and line breaks (#200)", () => {
	const stepCount = (source: string) => getAST(source).children.length;
	const texts = (source: string) =>
		(getAST(source).children[0] as any).children.map((c: any) => c.value);

	for (const blank of [" ", "\t", " \t "]) {
		it(`ends a step at a line of ${JSON.stringify(blank)}`, () => {
			expect(stepCount(`Mix.\n${blank}\nBake.`)).toBe(2);
		});
	}

	it("ends a step at a line of blanks inside a section, and after a header", () => {
		const [section] = getAST("## Dough\n \nMix.\n\t\n \nBake.\n  ").children;
		expect((section as any).children).toHaveLength(2);
	});

	for (const char of ["\u00a0", "\u3000", "\ufeff"]) {
		it(`keeps a line of ${JSON.stringify(char)} inside its step`, () => {
			expect(stepCount(`Mix.\n${char}\nBake.`)).toBe(1);
		});
	}

	it("reads a lone CR as a line break", () => {
		expect(texts("Mix\rwell.")).toEqual(["Mix", " ", "well."]);
		expect(stepCount("Mix.\r\rBake.")).toBe(2);
		expect(texts("Mix.\r")).toEqual(["Mix."]);
	});

	it("reads CRLF like LF", () => {
		expect(stepCount("Mix.\r\n\r\nBake.\r\n")).toBe(2);
		expect(texts("Mix\r\nwell.")).toEqual(["Mix", " ", "well."]);
	});

	it("drops the blanks ending a line of a step", () => {
		expect(texts("Mix \t\nwell. ")).toEqual(["Mix", " ", "well."]);
	});

	it("skips a byte order mark opening the file", () => {
		const ast = getAST("\ufeff## Dough\n\nMix.");
		expect(ast.children).toHaveLength(1);
		expect(ast.children[0]).toMatchObject({ type: ASTNodeType.Section });
		expect(getAST("\ufeff---\ntitle: Bread\n---\nMix.").meta).toEqual({
			title: "Bread",
		});
	});
});

// Found by the fuzz (#281): `alias = ":" refName` took the blanks after `@salt: ` at
// the end of a line as an empty alias, and the `:` vanished from the step,
// while `@salt:` kept it as text. Stripping the trailing blank (what the
// formatter does) changed the recipe.
describe("a colon followed by blanks alone is no alias", () => {
	const step = (source: string) =>
		(getAST(source).children[0] as any).children.map((c: any) =>
			c.type === ASTNodeType.Ingredient || c.type === ASTNodeType.Cookware
				? { name: c.name, alias: c.alias }
				: c.value,
		);

	// Up to a line break (LF, CRLF, lone CR) or the end of the file.
	for (const rest of [
		"\nok.",
		" \nok.",
		"\t\nok.",
		" \r\nok.",
		" \rok.",
		" ",
		"\t",
	]) {
		it(`keeps the colon of ${JSON.stringify(`@salt:${rest}`)} as text`, () => {
			expect(step(`Add @salt:${rest}`).slice(0, 3)).toEqual([
				"Add ",
				{ name: "salt", alias: null },
				":",
			]);
		});
	}

	it("does the same for a bare #cookware", () => {
		expect(step("Take #pan: \nok.").slice(0, 3)).toEqual([
			"Take ",
			{ name: "pan", alias: null },
			":",
		]);
	});

	it("still reads a real alias, glued to the colon", () => {
		expect(step("With @dry white wine:wine{100ml}.")[1]).toEqual({
			name: "dry white wine",
			alias: "wine",
		});
		expect(step("Use the #cast iron skillet:skillet{}.")[1]).toEqual({
			name: "cast iron skillet",
			alias: "skillet",
		});
		expect(step("Add @salt:fleur de sel.")[1]).toEqual({
			name: "salt",
			alias: "fleur de sel.",
		});
	});
});

// #273: `alias = ":" refName` also took a name starting with a blank, so a `:`
// written as punctuation after a bare mention read the rest of the line as
// its alias, and that text vanished from the step. The alias now starts right
// after the colon, or the colon is text.
describe("a colon followed by a blank is punctuation, not an alias", () => {
	const step = (source: string) =>
		(getAST(source).children[0] as any).children.map((c: any) =>
			c.type === ASTNodeType.Ingredient || c.type === ASTNodeType.Cookware
				? { name: c.name, alias: c.alias }
				: c.value,
		);

	it("keeps the rest of the line after a bare #cookware", () => {
		expect(step("Heat the #pan: then add oil.")).toEqual([
			"Heat the ",
			{ name: "pan", alias: null },
			": then add oil.",
		]);
	});

	it("keeps the rest of the line after a bare @ingredient", () => {
		expect(step("Add @flour: sifted.")).toEqual([
			"Add ",
			{ name: "flour", alias: null },
			": sifted.",
		]);
	});

	it("keeps it after a tab too", () => {
		expect(step("Heat the #pan:\tthen add oil.")).toEqual([
			"Heat the ",
			{ name: "pan", alias: null },
			":\tthen add oil.",
		]);
	});

	it("leaves a colon after braces as text, as before", () => {
		expect(step("Mix @flour{200g}: then rest.").slice(2)).toEqual([
			": then rest.",
		]);
	});
});
