import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import {
	analyze,
	findClosestIngredients,
	getIngredientData,
	isKnownIngredient,
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

// The "unknown ingredient" verdict and its spelling suggestion live here, next
// to the resolution nutrition uses, so the editor and `gram check` can never
// disagree with it (they used to keep their own copies in the LSP).
describe("isKnownIngredient", () => {
	it("agrees with getIngredientData on keys, names, aliases and slugs", () => {
		const butter: IngredientData = { name: "Butter", aliases: ["beurre"] };
		const db = { "huile-dolive": oliveOil, butter };
		expect(isKnownIngredient("Huile d'olive", db)).toBe(true);
		expect(isKnownIngredient("huile-d-olive", db)).toBe(true);
		expect(isKnownIngredient("Beurre", db)).toBe(true);
		expect(isKnownIngredient("butter", db)).toBe(true);
		expect(isKnownIngredient("margarine", db)).toBe(false);
		expect(isKnownIngredient("anything", {})).toBe(false);
	});

	it("needs a declared alias for a plural: no guessing", () => {
		const carrot: IngredientData = { name: "Carotte" };
		expect(isKnownIngredient("carottes", { carotte: carrot })).toBe(false);
		expect(
			isKnownIngredient("carottes", {
				carotte: { ...carrot, aliases: ["carottes"] },
			}),
		).toBe(true);
	});
});

describe("findClosestIngredients", () => {
	const carrot: IngredientData = { name: "Carotte" };
	const butter: IngredientData = { name: "Beurre doux", aliases: ["beurre"] };

	it("suggests the entry name whose key, name or alias is closest", () => {
		const db = { carotte: carrot, "beurre-doux": butter };
		expect(findClosestIngredients("carote", db)).toEqual(["Carotte"]);
		// Reached through the alias, reported by the entry's name.
		expect(findClosestIngredients("beure", db)).toEqual(["Beurre doux"]);
	});

	it("returns every entry at the minimal distance, in database order", () => {
		const db = {
			bat: { name: "Bat" },
			far: { name: "Far" },
			cat: { name: "Cat" },
			car: { name: "Car" },
		};
		// "cax" is 1 away from cat and car, 2 away from bat and far.
		expect(findClosestIngredients("cax", db)).toEqual(["Cat", "Car"]);
	});

	it("keeps only the strictly closer candidates when one beats the others", () => {
		const db = { bat: { name: "Bat" }, cat: { name: "Cat" } };
		expect(findClosestIngredients("ca", db)).toEqual(["Cat"]);
	});

	it("lists an entry once even when several of its labels tie", () => {
		const db = { tomate: { name: "Tomate", aliases: ["tomato"] } };
		expect(findClosestIngredients("tomat", db)).toEqual(["Tomate"]);
	});

	it("respects maxDistance and never suggests an exact match", () => {
		const db = { carotte: carrot };
		expect(findClosestIngredients("xyz", db)).toEqual([]);
		expect(findClosestIngredients("carott", db, 0)).toEqual([]);
		expect(findClosestIngredients("carotte", db)).toEqual([]);
		expect(findClosestIngredients("carotte", {})).toEqual([]);
	});
});
