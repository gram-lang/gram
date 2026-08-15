import { describe, it, expect, afterEach } from "bun:test";
import { buildViewModel } from "../src/services/viewer";
import { writeTmpFile, cleanupTmpFile, makeDb } from "./helpers";

describe("buildViewModel", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("extracts title, servings, and section/step/ingredient structure", async () => {
		const path = await tmp(
			'---\ntitle: "Crepes"\nportions: 4\n---\n## Batter\n[Mix] Combine the @flour{200g} and @eggs{2}.\n',
		);
		const vm = await buildViewModel(path, {});
		expect(vm.title).toBe("Crepes");
		// `portions` is the canonical key. This used to read `meta.servings` —
		// a field the language doesn't have — and hand back the raw string, so
		// the header never showed a serving count.
		expect(vm.servings).toBe(4);
		expect(vm.sections).toHaveLength(1);
		expect(vm.sections[0]?.title).toBe("Batter");
		expect(vm.sections[0]?.ingredients.map((i) => i.name)).toEqual([
			"flour",
			"eggs",
		]);
		expect(vm.sections[0]?.steps).toHaveLength(1);
		expect(vm.sections[0]?.steps[0]?.action).toBe("Mix");
		expect(vm.sections[0]?.steps[0]?.text).toContain("flour");
	});

	it("reports no serving count when the recipe declares none", async () => {
		const path = await tmp("## Batter\n[Mix] Add @flour{200g}.\n");
		const vm = await buildViewModel(path, {});
		expect(vm.servings).toBeNull();
	});

	it("falls back to the file basename when no title is set", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const vm = await buildViewModel(path, {});
		expect(vm.title).not.toBe("");
		expect(vm.servings).toBeNull();
	});

	it("builds the shopping list without a database", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const vm = await buildViewModel(path, {});
		expect(vm.shoppingList).toEqual([
			{ name: "flour", displayQty: "200 g", isEstimate: false },
		]);
	});

	it("uses the database display name in the shopping list and sections when analyzed", async () => {
		const db = makeDb({
			flour: { name: "Wheat Flour", physical: { density: 0.59 } },
		});
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const vm = await buildViewModel(path, { db });
		expect(vm.shoppingList[0]?.name).toBe("Wheat Flour");
		expect(vm.sections[0]?.ingredients[0]?.name).toBe("Wheat Flour");
	});

	it("keeps the recipe's own (non-English) name in the shopping list even with an English-only database", async () => {
		const db = makeDb({ flour: { aliases: ["farine"] } });
		const path = await tmp("## Prep\n[Mix] Add @farine{200g}.\n");
		const vm = await buildViewModel(path, { db });
		expect(vm.shoppingList[0]?.name).toBe("farine");
	});

	it("groups composite ingredient children under their parent with a MAX-rule parent quantity", async () => {
		const path = await tmp(
			"## Prep\n[Separate] Crack the @egg yolks{2}<@eggs{2} and @egg whites{4}<@eggs{4}.\n",
		);
		const vm = await buildViewModel(path, {});
		const composite = vm.sections[0]?.ingredients.find(
			(i) => i.name === "eggs",
		);
		expect(composite).toBeDefined();
		expect(composite?.children?.map((c) => c.name).sort()).toEqual([
			"egg whites",
			"egg yolks",
		]);
		// MAX rule: parent qty should reflect the larger child (4), not the sum (6) or the first (2)
		expect(composite?.displayQty).toBe("4");
	});

	it("computes nutrition and missingIngredients only when a database is analyzed", async () => {
		const db = makeDb({
			flour: {
				physical: { density: 0.59 },
				nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
			},
		});
		const path = await tmp(
			"## Prep\n[Mix] Add @flour{200g} and @unknown-thing{10g}.\n",
		);
		const vm = await buildViewModel(path, { db });
		expect(vm.nutrition).not.toBeNull();
		expect(vm.missingIngredients).toContain("unknown-thing");
	});

	it("returns null nutrition and an empty missingIngredients list without a database", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const vm = await buildViewModel(path, {});
		expect(vm.nutrition).toBeNull();
		expect(vm.missingIngredients).toEqual([]);
	});

	it("reports total/prep/cook times when the recipe declares them", async () => {
		const path = await tmp(
			"## Prep ~{10min}\n[Mix] Add @flour{200g}. ~_{5min}\n",
		);
		const vm = await buildViewModel(path, {});
		expect(vm.times).not.toBeNull();
	});

	it("scales quantities when a scaleFactor is provided", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const vm = await buildViewModel(path, { scaleFactor: 2 });
		expect(vm.sections[0]?.ingredients[0]?.displayQty).toBe("400 g");
	});
});
