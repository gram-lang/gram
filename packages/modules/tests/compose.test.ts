import { describe, it, expect } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import { loadModuleGraph } from "../src/graph";
import { composeRecipe, finalizeComposed } from "../src/compose";
import { createFakeHost } from "./fake-host";

const db = {};

async function build(
	files: Record<string, string>,
	entry = "/recipe.gram",
	stock?: Set<string>,
) {
	const host = createFakeHost(files);
	const graph = await loadModuleGraph(entry, host);
	const composed = composeRecipe(graph, { db, stock });
	const compiled = compile(composed.ast);
	const analyzed = analyze(compiled, {
		...db,
		...composed.syntheticIngredients,
	}).result;
	const result = finalizeComposed(analyzed, composed);
	return { result, composed, graph };
}

// End-to-end coverage of the module composer (Phases B-D of the
// module-imports RFC), driven entirely through the public pipeline
// (loadModuleGraph -> composeRecipe -> compile -> finalizeComposed) against
// an in-memory host — no real filesystem.

describe("composeRecipe end-to-end", () => {
	it("splices a default-bound module inline at scale factor 1", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./pate.gram" as &pate

## Montage

[Foncer] avec &pate{200g}.
`,
			"/pate.gram": "## Pastry ->&paton\n\nMix @flour{200g}.\n",
		});

		expect(result.warnings.filter((w) => w.code.startsWith("MODULE"))).toEqual(
			[],
		);
		expect(result.sections).toHaveLength(2);
		expect(result.sections[0]?.title).toBe("Pastry");
		expect(result.sections[0]?.intermediate_preparation).toBe("pate");
		const flour = result.sections[0]?.ingredients.find((i) => i.id === "flour");
		expect(flour?.qty).toBe(200);
	});

	it("scales an imported module's ingredients by the derived factor", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./pate.gram" as &pate

## Montage

[Foncer] avec &pate{400g}.
`,
			"/pate.gram": "## Pastry ->&paton\n\nMix @flour{200g}.\n",
		});

		const flour = result.sections[0]?.ingredients.find((i) => i.id === "flour");
		expect(flour?.qty).toBe(400);
	});

	it("splices destructured bindings and merges shared ingredients on the shopping list", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./oeufs.gram" as { &blancs, &jaunes }

## Dessert

Whisk &blancs{100g} and &jaunes{50g}. Also add @flour{100g}.
`,
			"/oeufs.gram": `## Blancs ->&blancs

Separate @egg{100g}.

## Jaunes ->&jaunes

Separate @egg{50g}.
`,
		});

		const eggItem = result.shopping_list.find(
			(i): i is { id: string; qty?: number } => "id" in i && i.id === "egg",
		);
		// 100g (blancs) + 50g (jaunes) from the module, merged onto one line.
		expect(eggItem?.qty).toBe(150);
	});

	it("flags a host section redeclaring an already-bound intermediate as a scope conflict", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./pate.gram" as &pate

## Pate ->&pate

Mix @sugar{10g}.
`,
			"/pate.gram": "## Pastry ->&paton\n\nMix @flour{200g}.\n",
		});

		expect(result.warnings.map((w) => w.code)).toContain("SCOPE_CONFLICT");
	});

	it("reports MODULE_EXPORT_NOT_FOUND with a did-you-mean suggestion", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./oeufs.gram" as { &blanc }

## Dessert

Whisk &blanc{1}.
`,
			"/oeufs.gram": "## Blancs ->&blancs\n\nSeparate @egg{100g}.\n",
		});

		const w = result.warnings.find((x) => x.code === "MODULE_EXPORT_NOT_FOUND");
		expect(w).toBeDefined();
		expect(w?.message).toContain("blancs");
	});

	// RFC §F.3, non-regression #1 (§C.5 section barrier): a module with no
	// section headers at all must not spill its bare steps into the host's
	// own untitled section — the water's relative quantity must resolve
	// against the module's own flour, not the host's unrelated flour.
	it("does not let a module without sections contaminate the host's own untitled section", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./pate.gram" as &pate

@flour{500g} for something else.

Use &pate{1}.
`,
			"/pate.gram": "Mix @flour{250g}.\n\n@water{70% @&flour}.\n",
		});

		// Regression guard: a module with no `->&` of its own has nothing for
		// the rename table to rename *from* (its default export's name is a
		// placeholder) — without synthesizing a real declaration first, the
		// host's own `&pate` reference silently never resolves.
		expect(result.warnings.map((w) => w.code)).not.toContain(
			"UNDEFINED_REFERENCE",
		);
		expect(result.sections).toHaveLength(2);
		expect(result.sections[0]?.intermediate_preparation).toBe("pate");
		const moduleSection = result.sections.find((s) =>
			s.ingredients.some((i) => i.formula),
		);
		const water = moduleSection?.ingredients.find((i) => i.id === "water");
		// 70% of the module's own 250g flour = 175, not 70% of the host's 500g.
		const waterQty = water?.qty;
		const waterValue =
			typeof waterQty === "number"
				? waterQty
				: (waterQty as { value?: number } | undefined)?.value;
		expect(waterValue).toBe(175);
	});

	it("does not raise a false CIRCULAR_REFERENCE across host/module sections", async () => {
		// Host: farine depends on eau. Module: eau depends on farine. Each
		// resolves fine within its own section; together they must not look
		// like a cycle (v0.0 preliminary fix, §C.5/§F.2).
		const { result } = await build({
			"/recipe.gram": `@use "./base.gram" as &base

## Host

@farine{50% &eau}.

Use &base{1}.
`,
			"/base.gram":
				"## Base ->&base\n\n@eau{70% @&farine}.\n\n@farine{100g}.\n",
		});

		expect(result.warnings.map((w) => w.code)).not.toContain(
			"CIRCULAR_REFERENCE",
		);
	});

	it("dedups a diamond dependency's ingredients onto one shopping-list line", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./b.gram" as &b
@use "./c.gram" as &c

## Assemble

Use &b{1} and &c{1}.
`,
			// b.gram and c.gram both bind their own import of d.gram to the
			// same local name "d" -- independently and legitimately, since
			// each is its own document with no idea the other exists. Their
			// two "d"s must not collide with each other: each gets renamed
			// again (b$d / c$d) the moment it's spliced further up, into the
			// host. Regression guard for a real bug: a collision-detection
			// set shared across the *whole* compose() call once flagged this
			// as a false SCOPE_CONFLICT before either had a chance to be
			// renamed into its final, non-colliding form.
			"/b.gram": '@use "./d.gram" as &d\n\n## B ->&b\n\nUse &d{1}.\n',
			"/c.gram": '@use "./d.gram" as &d\n\n## C ->&c\n\nUse &d{1}.\n',
			"/d.gram": "## D ->&d\n\nMix @flour{100g}.\n",
		});

		expect(result.warnings.map((w) => w.code)).not.toContain("SCOPE_CONFLICT");

		const flourLines = result.shopping_list.filter(
			(i) => "id" in i && i.id === "flour",
		);
		expect(flourLines).toHaveLength(1);
	});

	it("tags spliced sections and CompilationResult.modules with their origin", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./pate.gram" as &pate

## Montage

Use &pate{1}.
`,
			"/pate.gram":
				"---\ntitle: Pate Sablee\n---\n## Pastry ->&paton\n\nMix @flour{200g}.\n",
		});

		expect(result.modules).toHaveLength(1);
		expect(result.modules?.[0]).toMatchObject({
			binding: "pate",
			uri: "/pate.gram",
			title: "Pate Sablee",
		});
		expect(result.sections[0]?.module).toEqual({
			binding: "pate",
			uri: "/pate.gram",
			title: "Pate Sablee",
			mode: "inline",
		});
		expect(result.sections[1]?.module).toBeUndefined();
	});

	it("registers an unresolved import as a degraded intermediate instead of crashing", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./missing.gram" as &m

## Section

Use &m{100g}.
`,
		});

		// Both graph loading (loadModuleGraph) and kitchen's own §C.4 degraded
		// path independently notice the same missing file — deduped down to
		// one, not surfaced as two errors for one root cause.
		const notFound = result.warnings.filter(
			(w) => w.code === "MODULE_NOT_FOUND",
		);
		expect(notFound).toHaveLength(1);
		expect(notFound[0]?.message).toContain("./missing.gram");
		expect(result.warnings.map((w) => w.code)).not.toContain(
			"UNDEFINED_REFERENCE",
		);
	});
});

describe("composeRecipe: stock mode (module-imports RFC, stock/retro-planning redesign)", () => {
	it("splices no section at all for a stocked import — zero timeline cost, one shopping-list leaf", async () => {
		const { result } = await build(
			{
				"/recipe.gram": `@use "./pate.gram" as &pate

## Montage

Use &pate{200g}.
`,
				"/pate.gram":
					"---\ntitle: Pate\n---\n\n## Pastry\n\nMix @flour{150g} with @butter{50g} for ~{10min}, then leave to rest ~_{45min}.\n",
			},
			"/recipe.gram",
			new Set(["/pate.gram"]),
		);

		expect(result.warnings.filter((w) => w.code.startsWith("MODULE"))).toEqual(
			[],
		);
		// Only the host's own section — no synthesized or spliced section for
		// the base at all.
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0]?.title).toBe("Montage");

		// The module's own ingredients don't leak into the section's own
		// registered ingredients (nothing was spliced)...
		const flour = result.sections[0]?.ingredients.find((i) => i.id === "flour");
		expect(flour).toBeUndefined();

		// ...but the binding collapses to one purchasable shopping-list leaf.
		const pateLine = result.shopping_list.find(
			(i) => "id" in i && i.id === "pate",
		);
		expect(pateLine).toBeDefined();
		expect(
			result.shopping_list.find((i) => "id" in i && i.id === "flour"),
		).toBeUndefined();
	});

	it("still counts the stocked base's own real mass/nutrition toward the host's totals", async () => {
		// A real database is needed here (unlike the shared empty `db` other
		// tests in this file use) — the synthetic ingredient is only built once
		// `depAnalyzed.metrics.nutrition?.total` is non-empty and the base has
		// some measurable mass, which requires the module's own ingredients to
		// actually resolve against something.
		const richDb = {
			flour: {
				name: "Flour",
				nutrition: { calories: 364, protein: 10.3, carbs: 76.3, fat: 1.0 },
			},
			butter: {
				name: "Butter",
				nutrition: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81.1 },
			},
		};
		const files = {
			"/recipe.gram": `@use "./pate.gram" as &pate

## Montage

Use &pate{200g}.
`,
			"/pate.gram":
				"---\ntitle: Pate\n---\n\n## Pastry\n\nMix @flour{150g} with @butter{50g}.\n",
		};
		const host = createFakeHost(files);
		const graph = await loadModuleGraph("/recipe.gram", host);
		const composed = composeRecipe(graph, {
			db: richDb,
			stock: new Set(["/pate.gram"]),
		});

		// Sourced from the module's own real composition, not a black-box guess.
		expect(composed.syntheticIngredients.pate?.physical?.unit_weight).toBe(200);

		// Stocking an import must not change what the recipe *is* — its total
		// nutrition has to match what inlining the same base (unstocked) and
		// scaling it to the same 200g would have produced, up to the one
		// rounding step a stocked import's own `per100g` round-trip adds
		// (representing a whole sub-module as one ingredient forces its
		// nutrition through an intermediate per-100g rounding the inline path
		// never takes). Regression guard for a much larger version of that
		// same drift, where the synthetic profile was normalized against
		// `accountedMass` (the base's own known-ingredient mass) rather than
		// its full `totalMass` — multiple percentage points off as soon as a
		// base ingredient had no database entry, not just a rounding unit.
		const compiled = compile(composed.ast);
		const analyzed = analyze(compiled, {
			...richDb,
			...composed.syntheticIngredients,
		}).result;
		const stockedTotal = finalizeComposed(analyzed, composed).metrics.nutrition
			?.total;

		const inlineGraph = await loadModuleGraph(
			"/recipe.gram",
			createFakeHost(files),
		);
		const inlineComposed = composeRecipe(inlineGraph, { db: richDb });
		const inlineCompiled = compile(inlineComposed.ast);
		const inlineAnalyzed = analyze(inlineCompiled, richDb).result;
		const inlineTotal = finalizeComposed(inlineAnalyzed, inlineComposed).metrics
			.nutrition?.total;

		expect(stockedTotal).toBeDefined();
		expect(inlineTotal).toBeDefined();
		for (const [key, expected] of Object.entries(inlineTotal ?? {})) {
			const actual = (stockedTotal as Record<string, number>)[key];
			expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
				Math.max(1, expected * 0.01),
			);
		}
	});

	it("warns and shares the blended module nutrition profile on a stocked destructured import", async () => {
		const { result, composed } = await build(
			{
				"/recipe.gram": `@use "./oeufs.gram" as { &blancs, &jaunes }

## Dessert

Whisk &blancs{100g} and &jaunes{50g}.
`,
				"/oeufs.gram": `## Blancs ->&blancs

Separate @egg{100g}.

## Jaunes ->&jaunes

Separate @egg{50g}.
`,
			},
			"/recipe.gram",
			new Set(["/oeufs.gram"]),
		);

		expect(result.warnings.map((w) => w.code)).toContain(
			"STOCKED_DESTRUCTURED_NUTRITION_BLENDED",
		);
		// No splice at all, for either binding.
		expect(result.sections).toHaveLength(1);
		// "Blended" means the two bindings share the same whole-module
		// nutrition profile — `name` legitimately differs (each keeps its own
		// local binding name for display), so compare `.nutrition` alone
		// rather than the whole synthetic entry.
		expect(composed.syntheticIngredients.blancs?.nutrition).toEqual(
			composed.syntheticIngredients.jaunes?.nutrition,
		);
	});

	it("warns and ignores retro-planning combined with stock — nothing left to schedule", async () => {
		const { result } = await build(
			{
				"/recipe.gram": `@use "./pate.gram" as &pate ~{-2d}

## Montage

Use &pate{200g}.
`,
				"/pate.gram":
					"---\ntitle: Pate\n---\n\n## Pastry\n\nMix @flour{150g}.\n",
			},
			"/recipe.gram",
			new Set(["/pate.gram"]),
		);

		expect(result.warnings.map((w) => w.code)).toContain(
			"STOCKED_RETRO_PLANNING_IGNORED",
		);
		expect(result.sections).toHaveLength(1);
	});
});

describe("composeRecipe: @use-level retro-planning (module-imports RFC, stock/retro-planning redesign)", () => {
	it("anchors the section that produces the bound export, not the module's first section", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./pate.gram" as &pate ~{-1d}

## Montage

Use &pate{200g}.
`,
			"/pate.gram": `## Petrissage

Mix @flour{200g} for ~{10min}.

## Repos ->&pate

Rest for ~_{60min}.
`,
		});

		expect(result.sections[0]?.title).toBe("Petrissage");
		expect(result.sections[0]?.retro_planning).toBeFalsy();
		expect(result.sections[1]?.title).toBe("Repos");
		expect(result.sections[1]?.retro_planning?.raw).toBe("-1d");
	});

	it("the host's @use-level clause wins over the module's own, with a warning", async () => {
		const { result } = await build({
			"/recipe.gram": `@use "./levain.gram" as &levain ~{-2d}

## Pain

Mix in the &levain{200g}.
`,
			"/levain.gram":
				"---\ntitle: Levain\n---\n\n## Levain ~{-1d} ->&levain\n\nMix @flour{200g}.\n",
		});

		expect(result.warnings.map((w) => w.code)).toContain(
			"RETRO_PLANNING_OVERRIDE_SHADOWED",
		);
		expect(result.sections[0]?.retro_planning?.raw).toBe("-2d");
	});
});
