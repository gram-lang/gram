import { describe, expect, it } from "bun:test";
import { analyze } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { composeRecipe, finalizeComposed } from "../src/compose";
import { loadModuleGraph } from "../src/graph";
import { createFakeHost } from "./fake-host";

// A base's private intermediate is renamed when it is spliced (`pate` →
// `dough$pate`), so it can never collide with one of the importer's. The
// new name is an identity: a share or a ratio still finds its target by it,
// but what a reader sees (a formula, a warning) is what the author wrote.

async function build(base: string) {
	const host = createFakeHost({
		"/recipe.gram": `@use "./pate.gram" as &dough\n\n## Montage\n\nFill the &dough{}.\n`,
		"/pate.gram": base,
	});
	const graph = await loadModuleGraph("/recipe.gram", host);
	const composed = composeRecipe(graph, { db: {} });
	const { result } = analyze(compile(composed.ast), {
		...composed.syntheticIngredients,
	});
	const final = finalizeComposed(result, composed);
	return { result: final, warnings: final.warnings };
}

const salt = (result: Awaited<ReturnType<typeof build>>["result"]) =>
	result.sections.flatMap((s) => s.ingredients).find((i) => i.id === "salt");

describe("a base's private intermediate, as a target", () => {
	it("is found by its new name and shown by the one written", async () => {
		const { result, warnings } = await build(
			"## Petrissage\n\nMix @flour{500 g} and @water{300 g}. ->&pate\n\n## Repos\n\nWork @salt{2 g / 100 g &pate} into the &pate{800 g}.\n",
		);
		const usage = salt(result);
		expect(usage?.qty).toEqual({ type: "single", value: 16 });
		expect(usage?.formula?.target).toBe("pate");
		expect(usage?.dependencies).toEqual(["dough-pate"]);
		expect(JSON.stringify(warnings)).not.toContain("$");
	});

	it("never shows its new name in a warning", async () => {
		const { warnings } = await build(
			"## Petrissage\n\nMix @flour{500 g} and @water{300 g}. ->&pate\n\n## Repos\n\nWork @salt{2% &pate} into the &pate{}.\n",
		);
		const said = warnings.filter(
			(w) => w.code === "RELATIVE_QUANTITY_UNKNOWN_MASS",
		);
		expect(said).toHaveLength(1);
		expect(said[0]?.message).toContain("'&pate' is made by a step");
		expect(said[0]?.message).not.toContain("$");
	});
});
