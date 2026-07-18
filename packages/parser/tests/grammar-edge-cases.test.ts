import { describe, it, expect } from "bun:test";
import { getAST, ASTNodeType } from "../src/index";

// The audit (Phase 5) noted @gram-lang/parser — the foundation of the whole
// toolchain — had zero dedicated tests, only indirect coverage via kitchen's/
// analyzer's fixtures. These cover the grammar's basic constructs, one known
// hard-error path, and robustness against malformed/adversarial input (the
// language server parses arbitrary, possibly untrusted, .gram files on every
// keystroke — see Phase 3/4 — so a crash on bad input is a real concern).

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
});

describe("known hard error", () => {
	it("throws a descriptive syntax error for a space before the composite `<` sigil", () => {
		expect(() => getAST("## Section\n@ <@parent\n")).toThrow(/composite/i);
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
});
