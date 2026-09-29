import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import {
	analyze,
	getIngredientData,
	resolveCanonicalId,
	type IngredientData,
} from "../src/index";

const oliveOil: IngredientData = {
	name: "Huile d'olive",
	physical: { density: 1.14 },
	nutrition: { calories: 822, protein: 0, carbs: 0, fat: 91 },
};

describe("ingredient database lookup", () => {
	it("finds an entry whose key is not exactly slugify(name)", () => {
		const db = { "huile-dolive": oliveOil };
		expect(getIngredientData("Huile d'olive", db)).toBe(oliveOil);
		// The compiler id for "Huile d'olive" — what the analyzer really looks up.
		expect(getIngredientData("huile-d-olive", db)).toBe(oliveOil);
		expect(resolveCanonicalId("huile-d-olive", db)).toBe("huile-dolive");
	});

	it("finds an English key from its French display name", () => {
		const butter: IngredientData = { name: "Beurre" };
		expect(getIngredientData("beurre", { butter })).toBe(butter);
	});

	it("resolves aliases regardless of accents, case and punctuation", () => {
		const cream: IngredientData = {
			name: "Cream",
			aliases: ["Crème fraîche"],
		};
		expect(getIngredientData("creme-fraiche", { cream })).toBe(cream);
	});

	it("lets a real key win over another entry's homonymous alias", () => {
		const oil: IngredientData = { name: "Oil" };
		const other: IngredientData = { name: "Other", aliases: ["oil"] };
		expect(getIngredientData("oil", { other, oil })).toBe(oil);
	});

	it("keeps distinct non-Latin aliases distinct", () => {
		const butter: IngredientData = { name: "Butter", aliases: ["バター"] };
		const oil: IngredientData = { name: "Oil", aliases: ["масло"] };
		const db = { butter, oil };
		expect(getIngredientData("バター", db)).toBe(butter);
		expect(getIngredientData("масло", db)).toBe(oil);
	});

	it("returns null for an unknown ingredient", () => {
		expect(getIngredientData("nope", { "huile-dolive": oliveOil })).toBeNull();
	});
});

describe("analyze — apostrophe in ingredient name (issue #27)", () => {
	it("converts volume to mass and computes nutrition via a non-canonical key", () => {
		const compiled = compile(
			getAST("## Section\n\nFry in @Huile d'olive{10ml}.\n"),
		);
		const { result, missingIngredients } = analyze(compiled, {
			"huile-dolive": oliveOil,
		});
		const item = result.shopping_list.find(
			(i) => "id" in i && i.id === "huile-dolive",
		);
		expect(item).toMatchObject({ normalizedMass: 11.4 });
		expect(missingIngredients).toEqual([]);
	});
});
