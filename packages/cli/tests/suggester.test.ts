import { describe, it, expect, afterEach } from "bun:test";
import { suggestRecipes } from "../src/services/suggester";
import { writeTmpFile, cleanupTmpFile, makeDb } from "./helpers";

describe("suggestRecipes", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	function baseOpts(
		overrides: Partial<Parameters<typeof suggestRecipes>[1]> = {},
	) {
		return {
			withTerms: [],
			withoutTerms: [],
			db: null,
			minMatch: 0,
			top: 10,
			...overrides,
		};
	}

	it("scores 100 when all --with terms are present", async () => {
		const a = await tmp(
			'---\ntitle: "Crepes"\n---\n## Prep\n[Mix] Add @flour{200g} and @eggs{2}.\n',
		);
		const result = await suggestRecipes(
			[a],
			baseOpts({ withTerms: ["flour", "eggs"] }),
		);
		expect(result).toHaveLength(1);
		expect(result[0]?.score).toBe(100);
		expect(result[0]?.matched).toEqual(["flour", "eggs"]);
		expect(result[0]?.missing).toEqual([]);
		expect(result[0]?.title).toBe("Crepes");
	});

	it("scores partially when only some --with terms are present", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const result = await suggestRecipes(
			[a],
			baseOpts({ withTerms: ["flour", "sugar"] }),
		);
		expect(result[0]?.score).toBe(50);
		expect(result[0]?.matched).toEqual(["flour"]);
		expect(result[0]?.missing).toEqual(["sugar"]);
	});

	it("excludes a recipe containing a --without ingredient", async () => {
		const a = await tmp("## Prep\n[Mix] Add @peanuts{50g}.\n");
		const result = await suggestRecipes(
			[a],
			baseOpts({ withoutTerms: ["peanuts"] }),
		);
		expect(result).toHaveLength(0);
	});

	it("filters out recipes scoring below minMatch", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const result = await suggestRecipes(
			[a],
			baseOpts({ withTerms: ["flour", "sugar"], minMatch: 60 }),
		);
		expect(result).toHaveLength(0);
	});

	it("resolves ingredient terms and content through the database alias index", async () => {
		const db = makeDb({ butter: { aliases: ["beurre"] } });
		const a = await tmp("## Prep\n[Mix] Add @beurre{50g}.\n");
		const result = await suggestRecipes(
			[a],
			baseOpts({ withTerms: ["butter"], db }),
		);
		expect(result[0]?.score).toBe(100);
	});

	it("silently skips a file that fails to parse (a genuine grammar error, not just lenient garbage)", async () => {
		// The parser is deliberately lenient (garbage text just becomes a Text
		// node) — a space before the composite `<` sigil is one of the few
		// constructs it actually rejects with a SyntaxError.
		const a = await tmp("## Section\n@ <@parent\n");
		const result = await suggestRecipes(
			[a],
			baseOpts({ withTerms: ["flour"] }),
		);
		expect(result).toHaveLength(0);
	});

	it("silently skips a file that no longer exists", async () => {
		const result = await suggestRecipes(
			["/nonexistent/path/recipe.gram"],
			baseOpts({ withTerms: ["flour"] }),
		);
		expect(result).toHaveLength(0);
	});

	it("returns matched ingredients found inside an alternative option", async () => {
		const a = await tmp("## Prep\n[Mix] Add @butter{50g}|@oil{50ml}.\n");
		const result = await suggestRecipes([a], baseOpts({ withTerms: ["oil"] }));
		expect(result[0]?.matched).toEqual(["oil"]);
	});

	it("sorts by score descending, then by title/file", async () => {
		const a = await tmp(
			'---\ntitle: "B Recipe"\n---\n## P\n[Mix] Add @flour{1g}.\n',
		);
		const b = await tmp(
			'---\ntitle: "A Recipe"\n---\n## P\n[Mix] Add @flour{1g} and @sugar{1g}.\n',
		);
		const result = await suggestRecipes(
			[a, b],
			baseOpts({ withTerms: ["flour", "sugar"] }),
		);
		expect(result.map((r) => r.title)).toEqual(["A Recipe", "B Recipe"]);
	});

	it("caps results at `top`", async () => {
		const a = await tmp("## P\n[Mix] Add @flour{1g}.\n");
		const b = await tmp("## P\n[Mix] Add @flour{1g}.\n");
		const result = await suggestRecipes(
			[a, b],
			baseOpts({ withTerms: ["flour"], top: 1 }),
		);
		expect(result).toHaveLength(1);
	});

	it("scores 100 with no --with terms at all (nothing required)", async () => {
		const a = await tmp("## P\n[Mix] Add @flour{1g}.\n");
		const result = await suggestRecipes([a], baseOpts());
		expect(result[0]?.score).toBe(100);
	});
});
