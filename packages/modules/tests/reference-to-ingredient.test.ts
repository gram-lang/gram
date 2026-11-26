import { describe, expect, it } from "bun:test";
import { analyze } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { composeRecipe, finalizeComposed } from "../src/compose";
import { loadModuleGraph } from "../src/graph";
import { createFakeHost } from "./fake-host";

async function refsOf(files: Record<string, string>, stock?: Set<string>) {
	const graph = await loadModuleGraph("/recipe.gram", createFakeHost(files));
	const composed = composeRecipe(graph, { db: {}, stock });
	const compiled = compile(composed.ast);
	const analyzed = analyze(compiled, composed.syntheticIngredients).result;
	const { warnings } = finalizeComposed(analyzed, composed);
	// The module did resolve: no silence bought by a failed import.
	expect(
		warnings.filter((w) => /^MODULE|UNDEFINED_REFERENCE/.test(w.code)),
	).toEqual([]);
	return warnings.filter((w) => w.code === "REFERENCE_TO_INGREDIENT");
}

// Kitchen never sees `@use` once modules has composed the recipe: a binding
// comes back as a spliced `->&name` or a stocked synthetic leaf. Neither is a
// raw ingredient, so `&name` on it raises nothing.
describe("REFERENCE_TO_INGREDIENT across modules", () => {
	it("stays silent on a binding to a module with no `->&` (spliced)", async () => {
		expect(
			await refsOf({
				"/recipe.gram":
					'@use "./fond.gram" as &fond\n\n## Sauce\n\nVerser le &fond{200ml}.\n',
				"/fond.gram": "## Fond\n\nFaire mijoter @os{1kg} dans @eau{2l}.\n",
			}),
		).toEqual([]);
	});

	it("stays silent on a named export sharing a raw ingredient's name (spliced)", async () => {
		expect(
			await refsOf({
				"/recipe.gram":
					'@use "./base.gram" as { &chicken }\n\n## Serve\n\nPlate the &chicken.\n',
				"/base.gram": "## Base ->&chicken\n\nBrown @chicken{1}.\n",
			}),
		).toEqual([]);
	});

	it("stays silent on a stocked import", async () => {
		expect(
			await refsOf(
				{
					"/recipe.gram":
						'@use "./pate.gram" as &pate\n\n## Montage\n\nUse &pate{200g}.\n',
					"/pate.gram":
						"---\ntitle: Pate\n---\n\n## Pastry\n\nMix @flour{150g}.\n",
				},
				new Set(["/pate.gram"]),
			),
		).toEqual([]);
	});

	it("still warns once on a module's own '&' before its raw ingredient", async () => {
		const warnings = await refsOf({
			"/recipe.gram":
				'@use "./pate.gram" as &pate\n\n## Montage\n\nUse &pate{200g}.\n',
			"/pate.gram": "## Pastry\n\nMix @flour{150g}.\n\nDust with &flour.\n",
		});
		expect(warnings.map((w) => w.data)).toEqual([{ suggestion: "@&flour" }]);
	});
});
