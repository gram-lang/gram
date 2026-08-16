import { describe, it, expect, afterEach } from "bun:test";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModel } from "ai";
import { importWithAI } from "../src/services/importer";
import { makeDb } from "./helpers";

// End-to-end guardrails, with the AI replaced by a script of fixed answers.
// What's under test is what `gram import` does with a *bad* answer — the path
// that used to end with "write the file and exit 0" no matter what came back.

function scriptedModel(replies: string[]): LanguageModel {
	let call = 0;
	return new MockLanguageModelV3({
		doGenerate: async () => {
			const text = replies[Math.min(call, replies.length - 1)] as string;
			call++;
			return {
				content: [{ type: "text" as const, text }],
				finishReason: "stop" as const,
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
				warnings: [],
			};
		},
	}) as unknown as LanguageModel;
}

const dirs: string[] = [];
async function jsonLdFile(recipe: object): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "gram-import-"));
	dirs.push(dir);
	const path = join(dir, "recipe.json");
	await writeFile(path, JSON.stringify({ "@type": "Recipe", ...recipe }));
	return path;
}

afterEach(async () => {
	await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true })));
});

const SOURCE = {
	name: "Cookies",
	author: { "@type": "Person", name: "Auguste Kerflec" },
	recipeIngredient: ["200 g flour", "a pinch of salt"],
	recipeInstructions: [{ "@type": "HowToStep", text: "Mix." }],
};

describe("importWithAI — content that never reached the compiler", () => {
	it("reports ingredients swallowed by a mid-sentence // comment", async () => {
		const path = await jsonLdFile(SOURCE);
		const model = scriptedModel([
			`---
title: 'Cookies'
---

## Mix
Combine @flour{200g} // TODO: unsure, @baking soda{} and @salt{}.
`,
		]);

		const result = await importWithAI(path, model);
		expect(result.lostIngredients).toHaveLength(2);
		expect(result.lostIngredients.join(" ")).toContain("baking soda");
	});

	it("reports nothing on a clean conversion", async () => {
		const path = await jsonLdFile(SOURCE);
		const model = scriptedModel([
			`---
title: 'Cookies'
---

## Mix
Combine @flour{200g} and @salt{1 pinch}.
`,
		]);

		const result = await importWithAI(path, model);
		expect(result.lostIngredients).toEqual([]);
		expect(result.unresolvedErrors).toEqual([]);
	});
});

describe("importWithAI — errors the repair loop could not fix", () => {
	it("surfaces them instead of returning a broken file as a success", async () => {
		// The loop retries twice and then used to fall through without looking at
		// the result, so a file still referencing an undefined intermediate was
		// written with nothing but ordinary warnings.
		const broken = `---
title: 'Cookies'
---

## Mix
Combine @flour{200g} with &nonexistent.
`;
		const path = await jsonLdFile(SOURCE);
		const result = await importWithAI(path, scriptedModel([broken]));

		expect(result.unresolvedErrors.length).toBeGreaterThan(0);
	});

	it("clears them when a retry does fix the file", async () => {
		const broken = `---
title: 'Cookies'
---

## Mix
Combine @flour{200g} with &nonexistent.
`;
		const fixed = `---
title: 'Cookies'
---

## Mix
Combine @flour{200g} and @salt{1 pinch}.
`;
		const path = await jsonLdFile(SOURCE);
		const result = await importWithAI(path, scriptedModel([broken, fixed]));

		expect(result.unresolvedErrors).toEqual([]);
	});
});

describe("importWithAI — provenance comes from the source, not the model", () => {
	const invented = `---
title: 'Cookies'
author: 'Chef'
source: ['https://example.com/invented']
---

## Mix
Combine @flour{200g} and @salt{1 pinch}.
`;

	it("replaces an invented author with the one in the JSON-LD", async () => {
		const path = await jsonLdFile(SOURCE);
		const result = await importWithAI(path, scriptedModel([invented]));

		expect(result.gramContent).toContain("Auguste Kerflec");
		expect(result.gramContent).not.toContain("Chef");
	});

	it("strips an invented source URL when importing from a local file", async () => {
		const path = await jsonLdFile(SOURCE);
		const result = await importWithAI(path, scriptedModel([invented]));

		expect(result.gramContent).not.toContain("example.com");
	});

	it("strips an invented author when the source names none", async () => {
		const path = await jsonLdFile({ ...SOURCE, author: undefined });
		const result = await importWithAI(path, scriptedModel([invented]));

		expect(result.gramContent).not.toContain("Chef");
		expect(result.gramContent).not.toContain("author:");
	});
});

describe("importWithAI — analyzer report", () => {
	const clean = `---
title: 'Cookies'
---

## Mix
Combine @flour{200g} and @unobtainium{3g}.
`;

	it("is empty without a database", async () => {
		const path = await jsonLdFile(SOURCE);
		const result = await importWithAI(path, scriptedModel([clean]));
		expect(result.analysisGaps).toEqual([]);
	});

	it("names ingredients the database does not know", async () => {
		const path = await jsonLdFile(SOURCE);
		const result = await importWithAI(path, scriptedModel([clean]), {
			db: makeDb({ flour: {} }),
		});
		expect(result.analysisGaps.join(" ")).toContain("unobtainium");
	});
});
