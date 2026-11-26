import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { WarningCode, warningInfo } from "../src/warnings";

const compileSteps = (...steps: string[]) => {
	const source = `---\ntitle: T\n---\n\n## Prep\n\n${steps.join("\n\n")}\n`;
	return { source, result: compile(getAST(source)) };
};

const codes = (source: string, code: WarningCode) =>
	compile(getAST(source)).warnings.filter((w) => w.code === code);

// `&name` names an intermediate: on a raw ingredient, `@&name` was meant.
describe("REFERENCE_TO_INGREDIENT", () => {
	const refs = (...steps: string[]) => {
		const { source, result } = compileSteps(...steps);
		return {
			source,
			warnings: result.warnings.filter(
				(w) => w.code === WarningCode.REFERENCE_TO_INGREDIENT,
			),
		};
	};

	it("warns on '&' before a raw ingredient (EN)", () => {
		const { source, warnings } = refs(
			"Mix @flour{500g} with @water{300ml}.",
			"Dust with &flour.",
		);
		expect(warnings).toHaveLength(1);
		const [w] = warnings;
		expect(warningInfo[WarningCode.REFERENCE_TO_INGREDIENT].severity).toBe(
			"warning",
		);
		expect(w?.data).toEqual({ suggestion: "@&flour" });
		expect(w?.message).toContain("@&flour");
		expect(source.slice(w!.loc!.start, w!.loc!.end)).toBe("&flour");
	});

	it("warns with a quantity and a multi-word name (FR)", () => {
		const { source, warnings } = refs(
			"Mélanger la @farine{500g} et le @sucre glace{50g}.",
			"Fleurer avec &farine{20g}.",
			"Saupoudrer de &sucre glace{}.",
		);
		expect(warnings.map((w) => w.data)).toEqual([
			{ suggestion: "@&farine" },
			{ suggestion: "@&sucre glace" },
		]);
		expect(source.slice(warnings[0]!.loc!.start, warnings[0]!.loc!.end)).toBe(
			"&farine{20g}",
		);
	});

	it("ignores the case of the name, and trailing punctuation", () => {
		expect(
			refs("Mix @Flour{500g}.", "Dust with &flour.").warnings,
		).toHaveLength(1);
	});

	it("stays silent on '@&'", () => {
		expect(refs("Mix @flour{500g}.", "Dust with @&flour.").warnings).toEqual(
			[],
		);
	});

	it("stays silent on an intermediate declared by a step (EN and FR)", () => {
		expect(
			refs("Mix @flour{500g} ->&dough.", "Knead &dough.").warnings,
		).toEqual([]);
		expect(
			refs("Pétrir @farine{500g} et @eau{300ml} ->&pâte.", "Étaler la &pâte.")
				.warnings,
		).toEqual([]);
	});

	it("stays silent when the intermediate shares an ingredient's name", () => {
		// `->&chicken` re-declares the name: the reference means the product.
		expect(
			refs("Brown @chicken{1} ->&chicken.", "Serve the &chicken.").warnings,
		).toEqual([]);
	});

	it("stays silent on a section-level intermediate", () => {
		const source =
			"## Dough ->&dough\n\nMix @flour{500g}.\n\n## Bake\n\nBake &dough.\n";
		expect(codes(source, WarningCode.REFERENCE_TO_INGREDIENT)).toEqual([]);
	});

	it("stays silent on an unresolved `@use` binding (EN and FR)", () => {
		expect(
			codes(
				'@use "./stock.gram" as &stock\n\n## Soup\n\nAdd @stock{1}.\n\nPour &stock.\n',
				WarningCode.REFERENCE_TO_INGREDIENT,
			),
		).toEqual([]);
		expect(
			codes(
				'@use "./fond.gram" as &fond\n\n## Sauce\n\nVerser le &fond.\n',
				WarningCode.REFERENCE_TO_INGREDIENT,
			),
		).toEqual([]);
	});

	it("leaves an undefined reference to UNDEFINED_REFERENCE", () => {
		const { result } = compileSteps("Brown the &chicken.");
		expect(result.warnings.map((w) => w.code)).toEqual([
			WarningCode.UNDEFINED_REFERENCE,
		]);
	});

	it("keeps the reference in the compiled recipe", () => {
		const { result } = compileSteps("Mix @flour{500g}.", "Dust with &flour.");
		expect(
			result.sections[0]?.ingredients.map((u) => u.type ?? "ingredient"),
		).toEqual(["ingredient", "reference"]);
	});
});

// Cooklang separates the number from the unit with `%`: `~{15%minutes}`.
describe("INVALID_DURATION suggestion for Cooklang's '%'", () => {
	const timer = (step: string) =>
		compileSteps(step).result.warnings.filter(
			(w) => w.code === WarningCode.INVALID_DURATION,
		);

	it("suggests the duration with a space", () => {
		const [w] = timer("Cook ~{15%min}.");
		expect(w?.data).toEqual({ suggestion: "15 min" });
		expect(w?.message).toContain("~{15 min}");
		expect(timer("Cook ~{15%minutes}.")[0]?.data).toEqual({
			suggestion: "15 minutes",
		});
		expect(timer("Cook ~pasta{1-2 % h}.")[0]?.data).toEqual({
			suggestion: "1-2 h",
		});
	});

	it("suggests nothing for any other refused duration", () => {
		const [w] = timer("Cook ~{1:30}.");
		expect(w).toBeDefined();
		expect(w?.data).toBeUndefined();
	});

	it("suggests nothing when the result would not read either", () => {
		expect(timer("Cook ~{15%foo}.").every((w) => !w.data)).toBe(true);
	});
});

// The same separator on an ingredient left the unit "%g": no mass, no word.
describe("INVALID_UNIT for Cooklang's '%' on an ingredient", () => {
	const units = (step: string) =>
		compileSteps(step).result.warnings.filter(
			(w) => w.code === WarningCode.INVALID_UNIT,
		);

	it("warns and suggests the unit alone (EN and FR)", () => {
		const [w] = units("Mix @flour{200%g}.");
		expect(w?.data).toEqual({ reason: "cooklangSeparator", suggestion: "g" });
		expect(w?.message).toContain("{200 g}");
		expect(units("Ajouter le @lait{1/2 % cup}.")[0]?.data).toEqual({
			reason: "cooklangSeparator",
			suggestion: "cup",
		});
		expect(units("Ajouter le @lait{25%cl}.")[0]?.data).toEqual({
			reason: "cooklangSeparator",
			suggestion: "cl",
		});
	});

	it("stays silent on a relative quantity and on units it does not know", () => {
		expect(units("Mix @flour{500g}.\n\nAdd @salt{2% @&flour}.")).toEqual([]);
		expect(units("Add @garlic{2%cloves}.")).toEqual([]);
		expect(units("Add @chocolate{70 % cacao}.")).toEqual([]);
	});
});
