import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { loadModuleGraph } from "../src/graph";
import { composeRecipe } from "../src/compose";
import { createFakeHost } from "./fake-host";

async function compose(files: Record<string, string>, stock?: Set<string>) {
	const graph = await loadModuleGraph("/recipe.gram", createFakeHost(files));
	return composeRecipe(graph, { db: {}, stock });
}

const span = (text: string, loc?: { start: number; end: number }) =>
	loc ? text.slice(loc.start, loc.end) : undefined;

describe("the location of an anchor across modules", () => {
	it("points into the module for an anchor written in the module", async () => {
		const levain =
			"---\ntitle: Levain\n---\n\n## Levain ~{-1:30} ->&levain\n\nMix @flour{200g}.\n";
		const composed = await compose({
			"/recipe.gram":
				'@use "./levain.gram" as &levain\n\n## Pain\n\nMix in the &levain{200g}.\n',
			"/levain.gram": levain,
		});
		const warning = compile(composed.ast).warnings.find(
			(w) => w.code === "INVALID_DURATION",
		);
		expect(warning?.loc?.uri).toBe("/levain.gram");
		expect(span(levain, warning?.loc)).toBe("~{-1:30}");
	});

	it("points at the @use anchor in the host for an anchor written there", async () => {
		const recipe =
			'@use "./levain.gram" as &levain ~{-1:30}\n\n## Pain\n\nMix in the &levain{200g}.\n';
		const composed = await compose({
			"/recipe.gram": recipe,
			"/levain.gram":
				"---\ntitle: Levain\n---\n\n## Levain ->&levain\n\nMix @flour{200g}.\n",
		});
		const warning = compile(composed.ast).warnings.find(
			(w) => w.code === "INVALID_DURATION",
		);
		expect(warning?.loc?.uri).toBeUndefined();
		expect(span(recipe, warning?.loc)).toBe("~{-1:30}");
	});

	it("points the module warnings about a @use anchor at the anchor", async () => {
		const recipe =
			'@use "./levain.gram" as &levain ~{-2d}\n\n## Pain\n\nMix in the &levain{200g}.\n';
		const levain =
			"---\ntitle: Levain\n---\n\n## Levain ~{-1d} ->&levain\n\nMix @flour{200g}.\n";
		const shadowed = await compose({
			"/recipe.gram": recipe,
			"/levain.gram": levain,
		});
		const stocked = await compose(
			{ "/recipe.gram": recipe, "/levain.gram": levain },
			new Set(["/levain.gram"]),
		);
		for (const [composed, code] of [
			[shadowed, "RETRO_PLANNING_OVERRIDE_SHADOWED"],
			[stocked, "STOCKED_RETRO_PLANNING_IGNORED"],
		] as const) {
			const warning = composed.warnings.find((w) => w.code === code);
			expect(span(recipe, warning?.loc)).toBe("~{-2d}");
		}
	});
});
