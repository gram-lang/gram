import { describe, it, expect } from "bun:test";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	fetchRecipe,
	parseRecipeResponse,
	validateGram,
	buildImportPayload,
} from "../src/services/importer";
import { GramCLIError } from "../src/errors";

// Regression tests for the two guardrails the security audit (Phase 3) identified
// on the `gram import` pipeline: fetchRecipe() is the only boundary between
// untrusted external content and the AI prompt, and validateGram() is the only
// gate between AI-generated text and a written .gram file.
//
// Audit 2026-07-22, cli finding I-2 (SSRF, Phase 18): these used to spin up a
// real local HTTP server and fetch it via `fetchRecipe` — which is exactly
// what the SSRF fix (`assertPublicUrl`) now correctly refuses, since a local
// test server is unavoidably bound to a loopback address. The response-
// parsing logic they were actually testing (content-type dispatch, HTML
// JSON-LD scraping) is exercised directly via `parseRecipeResponse` instead,
// with no network involved; a separate test below confirms `fetchRecipe`
// itself still refuses a loopback URL end-to-end (see also ssrf.test.ts for
// the full parameterized sweep over forbidden address ranges).

const RECIPE_JSON_LD = {
	"@context": "https://schema.org",
	"@type": "Recipe",
	name: "Test Pancakes",
	recipeIngredient: ["200g flour", "1 egg"],
	recipeInstructions: ["Mix everything."],
};

describe("parseRecipeResponse", () => {
	it("parses a direct application/json response", () => {
		const { jsonLd } = parseRecipeResponse(
			JSON.stringify(RECIPE_JSON_LD),
			"application/json",
		);
		expect(jsonLd["@type"]).toBe("Recipe");
		expect(jsonLd.name).toBe("Test Pancakes");
	});

	it("extracts JSON-LD embedded in an HTML page (the gram import <url> scraping path)", () => {
		const html = `<html><head><script type="application/ld+json">${JSON.stringify(RECIPE_JSON_LD)}</script></head><body></body></html>`;
		const { jsonLd } = parseRecipeResponse(html, "text/html");
		expect(jsonLd["@type"]).toBe("Recipe");
		expect(jsonLd.name).toBe("Test Pancakes");
	});

	it("throws when the page has no schema.org Recipe JSON-LD", () => {
		expect(() =>
			parseRecipeResponse(
				"<html><body>no recipe here</body></html>",
				"text/html",
			),
		).toThrow(GramCLIError);
	});
});

describe("fetchRecipe", () => {
	it("reads and parses a local JSON-LD file when given a filesystem path", async () => {
		const path = join(tmpdir(), `gram-test-recipe-${Date.now()}.json`);
		await writeFile(path, JSON.stringify(RECIPE_JSON_LD), "utf-8");
		try {
			const { jsonLd } = await fetchRecipe(path);
			expect(jsonLd.name).toBe("Test Pancakes");
		} finally {
			await unlink(path);
		}
	});

	// Audit 2026-07-22, cli finding I-2 (SSRF): a URL is refused before any
	// request is made at all, regardless of what it would have served —
	// proven here with a real local server that never gets hit.
	it("refuses to fetch a loopback URL end-to-end (SSRF guard)", async () => {
		const server = Bun.serve({
			port: 0,
			fetch: () => new Response(JSON.stringify(RECIPE_JSON_LD)),
		});
		try {
			await expect(fetchRecipe(`${server.url}recipe.json`)).rejects.toThrow(
				GramCLIError,
			);
		} finally {
			server.stop(true);
		}
	});
});

describe("validateGram", () => {
	it("returns no errors for syntactically valid .gram content", () => {
		const errors = validateGram("## Section\nMix @flour{200g}.\n");
		expect(errors).toEqual([]);
	});

	it("surfaces compiler warnings (e.g. a reference to an undefined ingredient) — the last line of defense before writing AI output to disk", () => {
		const errors = validateGram(
			"## Section\nMix &undefined_thing{100g} into the bowl.\n",
		);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]).toContain("undefined_thing");
	});

	it("surfaces a hard parse error as a single message rather than throwing", () => {
		// The .gram grammar is deliberately lenient (unmatched syntax degrades to
		// plain text rather than failing), so a genuine parse exception is rare in
		// practice — this exercises the catch-branch itself, not real grammar input.
		const errors = validateGram(null as unknown as string);
		expect(errors.length).toBe(1);
	});
});

describe("buildImportPayload", () => {
	it("keeps only the fields the spec prompt uses, cleaned of HTML markup and entities", () => {
		const payload = buildImportPayload(
			{
				name: "Pancakes",
				description: "Fluffy &amp; simple <b>pancakes</b>",
				author: { "@type": "Person", name: "Jane  Doe" },
				recipeCategory: "Breakfast",
				keywords: "easy, quick",
				recipeYield: "8 servings",
				prepTime: "PT10M",
				cookTime: "PT20M",
				totalTime: "PT30M",
				image: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
				aggregateRating: { ratingValue: 4.8, ratingCount: 312 },
				review: [{ author: "Someone", reviewBody: "Loved it!" }],
			},
			"https://example.com/pancakes",
			["200g <b>flour</b>", "1 egg"],
			[{ text: "Mix &nbsp;everything." }],
		);

		expect(payload.name).toBe("Pancakes");
		expect(payload.description).toBe("Fluffy & simple pancakes");
		expect(payload.author).toBe("Jane Doe");
		expect(payload.url).toBe("https://example.com/pancakes");
		expect(payload.recipeCategory).toBe("Breakfast");
		expect(payload.keywords).toBe("easy, quick");
		expect(payload.recipeYield).toBe("8 servings");
		expect(payload.prepTime).toBe("PT10M");
		expect(payload.recipeIngredient).toEqual(["200g flour", "1 egg"]);
		expect(payload.recipeInstructions).toEqual([{ text: "Mix everything." }]);
		expect(payload).not.toHaveProperty("image");
		expect(payload).not.toHaveProperty("aggregateRating");
		expect(payload).not.toHaveProperty("review");
	});

	it("normalizes an array of Person/string authors", () => {
		const payload = buildImportPayload(
			{ author: [{ name: "Jane" }, "John"] },
			undefined,
			[],
			[],
		);
		expect(payload.author).toEqual(["Jane", "John"]);
	});

	it("omits the url field for a local file source", () => {
		const payload = buildImportPayload({}, undefined, [], []);
		expect(payload).not.toHaveProperty("url");
	});
});
