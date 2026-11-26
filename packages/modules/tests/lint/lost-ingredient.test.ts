import { describe, expect, it } from "bun:test";
import { findWrittenIngredients } from "../../src/lint";
import { lintCode, spanOf } from "./lint-helpers";

const TITLE = "---\ntitle: T\n---\n\n";
const lost = (text: string) => lintCode("LOST_INGREDIENT", text);

describe("LOST_INGREDIENT", () => {
	it("flags each ingredient a '//' in the middle of a step swallows, on its token", () => {
		const text = `${TITLE}Mix @flour{200 g} // TODO amounts, @sugar{}, @salt{1 pinch}\n`;
		const found = lost(text);
		expect(found.map((d) => spanOf(text, d))).toEqual([
			"@sugar{}",
			"@salt{1 pinch}",
		]);
		expect(found[0]!.severity).toBe("warning");
		expect(found[0]!.message).toContain("'//'");
		expect(found[0]!.data).toEqual({ name: "sugar" });
		expect(found[0]!.fixes).toBeUndefined();
	});

	it("flags it in French too", () => {
		const text = `${TITLE}Mélanger @farine{200 g} // à doser, @sucre{50 g}\n`;
		expect(lost(text).map((d) => spanOf(text, d))).toEqual(["@sucre{50 g}"]);
	});

	it("does not flag an ingredient the recipe reads elsewhere", () => {
		const text = `${TITLE}Mix @flour{200 g} // or more @flour\n\nAdd @flour{50 g}.\n`;
		expect(lost(text)).toEqual([]);
	});

	it("does not flag a comment written on purpose: a whole '//' line or a block", () => {
		const text = `${TITLE}// note: @rye flour{} works too\n\nMix @flour{200 g}. /* or @spelt{200 g} */\n`;
		expect(lost(text)).toEqual([]);
	});

	it("does not flag an '@' read as text: a section title, a preparation, a share target", () => {
		const text = `${TITLE}## Sauce <@tomato\n\nAdd @flour{500 g}(sifted with @salt) and @water{50% @&flour}.\n`;
		expect(lost(text)).toEqual([]);
	});

	it("does not flag the frontmatter, even with CRLF line breaks, nor a @use line", () => {
		const crlf =
			"---\r\ntitle: X\r\nauthor: '@ChefJohn'\r\n---\r\n\r\nMix @b{1}. // see @ChefJohn\r\n";
		expect(lost(crlf).map((d) => spanOf(crlf, d))).toEqual(["@ChefJohn"]);
		expect(
			findWrittenIngredients(
				'@use "./base.gram" as &base\n\nMix &base{} with @a{1}.\n',
			).map((w) => w.name),
		).toEqual(["a"]);
		expect(
			findWrittenIngredients(
				"---\r\ntitle: X\r\nauthor: '@ChefJohn'\r\n---\r\n\r\nMix @b{1}.\r\n",
			).map((w) => w.name),
		).toEqual(["b"]);
	});

	it("stays silent without a compiled recipe to compare against", () => {
		const text = `${TITLE}Mix @flour{} // @sugar{}\n`;
		expect(lintCode("LOST_INGREDIENT", text, { compilation: null })).toEqual(
			[],
		);
	});
});
