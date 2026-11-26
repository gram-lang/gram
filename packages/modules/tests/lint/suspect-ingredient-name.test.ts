import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	SUSPECT_NAME_MAX_GRAPHEMES,
	SUSPECT_NAME_MAX_WORDS,
} from "../../src/lint/rules-writing";
import { applyFix, lintCode, spanOf } from "./lint-helpers";

const TITLE = "---\ntitle: T\n---\n\n";
const suspect = (text: string) => lintCode("SUSPECT_INGREDIENT_NAME", text);

describe("SUSPECT_INGREDIENT_NAME", () => {
	it("gives only a hint for a name with a comma, and a split that is never preferred", () => {
		const text = `${TITLE}Faire fondre le @chocolat noir 70 %, en pistoles{200 g}.\n`;
		const [d, ...rest] = suspect(text);
		expect(rest).toEqual([]);
		expect(d!.severity).toBe("hint");
		expect(spanOf(text, d!)).toBe("chocolat noir 70 %, en pistoles");
		const [fix] = d!.fixes!;
		expect(fix!.isPreferred).toBeUndefined();
		const fixed = applyFix(text, fix!);
		expect(fixed).toContain("@chocolat noir 70 %{200 g}(en pistoles).");
		const ingredient = (
			getAST(fixed).children[0] as {
				children: { name?: string; preparation?: string }[];
			}
		).children.find((c) => c.name)!;
		expect(ingredient.name).toBe("chocolat noir 70 %");
		expect(ingredient.preparation).toBe("en pistoles");
		expect(suspect(fixed)).toEqual([]);
	});

	it("flags '; ', '. ' and the CJK breaks too", () => {
		expect(suspect(`${TITLE}Add @butter; softened{50 g}.\n`)).toHaveLength(1);
		expect(suspect(`${TITLE}Add @flour. Sift it{50 g}.\n`)).toHaveLength(1);
		expect(suspect(`${TITLE}加える @砂糖、上白糖{50 g}。\n`)).toHaveLength(1);
	});

	it(`flags more than ${SUSPECT_NAME_MAX_WORDS} words, with no fix to guess`, () => {
		const text = `${TITLE}Add @the best ripe tomatoes from the market{3}.\n`;
		const [d] = suspect(text);
		expect(d!.fixes).toBeUndefined();
	});

	it(`flags more than ${SUSPECT_NAME_MAX_GRAPHEMES} characters, counted as graphemes`, () => {
		const long = "あ".repeat(SUSPECT_NAME_MAX_GRAPHEMES + 1);
		expect(suspect(`${TITLE}加える @${long}{1}。\n`)).toHaveLength(1);
		const fits = "あ".repeat(SUSPECT_NAME_MAX_GRAPHEMES);
		expect(suspect(`${TITLE}加える @${fits}{1}。\n`)).toEqual([]);
	});

	it("does not flag realistic names, in French and English", () => {
		for (const text of [
			`${TITLE}Add @extra virgin olive oil{2 tbsp}, then @salt{}.\n`,
			`${TITLE}Ajouter la @crème fraîche épaisse{20 cl}, puis le @sel{}.\n`,
			`${TITLE}Ajouter le @piment d'Espelette{1 pincée}.\n`,
			`${TITLE}Add @dark chocolate{200 g}(chopped, 70 %).\n`,
			`${TITLE}Mix @flour, @sugar and @eggs{2}.\n`,
			`${TITLE}Add @St. John's wort{1 g}.\n`,
			`${TITLE}Couper le @boudin env. 3 cm{1}.\n`,
		]) {
			expect(suspect(text)).toEqual([]);
		}
	});

	it("offers no split when the ingredient already has a preparation", () => {
		const text = `${TITLE}Add @butter, salted{50 g}(soft).\n`;
		const [d] = suspect(text);
		expect(d!.fixes).toBeUndefined();
	});
});
