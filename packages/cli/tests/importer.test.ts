import { describe, it, expect } from "bun:test";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	fetchRecipe,
	parseRecipeResponse,
	validateGram,
	buildImportPayload,
	collectAllWarnings,
	injectLanguage,
	cleanText,
	readInstructions,
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

	// #92: an article page with no Recipe block said "Import failed." under the
	// model line, and the reporter retried with other models. The message now
	// names the stage, what the page does describe, and that no model ran.
	it("names the stage and the types found when the page has no Recipe", () => {
		const html = `<script type="application/ld+json">${JSON.stringify({
			"@context": "https://schema.org",
			"@graph": [{ "@type": "Article" }, { "@type": "Organization" }],
		})}</script>`;
		expect(() => parseRecipeResponse(html, "text/html")).toThrow(
			/^No recipe found in the source: .*only describes Article, Organization\b.*no AI model was called/,
		);
	});

	it("says so when the page has no JSON-LD at all", () => {
		expect(() => parseRecipeResponse("<html></html>", "text/html")).toThrow(
			/no JSON-LD structured data at all/,
		);
	});

	it("finds a Recipe whose @type is an array", () => {
		const html = `<script type="application/ld+json">${JSON.stringify({
			"@graph": [
				{ "@type": "WebPage" },
				{ ...RECIPE_JSON_LD, "@type": ["Recipe", "NewsArticle"] },
			],
		})}</script>`;
		expect(parseRecipeResponse(html, "text/html").jsonLd.name).toBe(
			"Test Pancakes",
		);
	});

	it("names the stage when a JSON response is not valid JSON", () => {
		expect(() => parseRecipeResponse("{oops", "application/json")).toThrow(
			/^No recipe found in the source: the response is not valid JSON/,
		);
	});
});

describe("fetchRecipe", () => {
	it("names the read stage when a local file is missing", async () => {
		await expect(
			fetchRecipe(join(tmpdir(), "gram-no-such-recipe.json")),
		).rejects.toThrow(/^Could not read the source: /);
	});

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

	it("does not surface a warning-severity issue (e.g. an unresolved relative-quantity target) — retrying the AI on these just burns tokens without a fixable defect", () => {
		const errors = validateGram(
			"## Section\nMix @flour{200g} and @salt{2% &missing_var} together.\n",
		);
		expect(errors).toEqual([]);
	});
});

describe("collectAllWarnings", () => {
	it("surfaces every compiler warning, unlike validateGram() which only keeps error-severity ones", () => {
		const warnings = collectAllWarnings(
			"## Section\nMix @flour{200g} and @salt{2% &missing_var} together.\n",
		);
		expect(warnings.length).toBeGreaterThan(0);
		expect(warnings[0]).toContain("missing_var");
	});

	it("returns no warnings for clean, fully valid content", () => {
		const warnings = collectAllWarnings("## Section\nMix @flour{200g}.\n");
		expect(warnings).toEqual([]);
	});
});

describe("cleanText", () => {
	it("decodes decimal and hex numeric character references", () => {
		// é and a right single quotation mark ('), as WordPress/RSS commonly encode them
		expect(cleanText("d&#233;sossé")).toBe("désossé");
		expect(cleanText("chef&#8217;s knife")).toBe("chef’s knife");
		expect(cleanText("caf&#xe9;")).toBe("café");
	});

	it("resolves double-encoded entities (e.g. &amp;#39; from a re-escaped feed)", () => {
		expect(cleanText("chef&amp;#39;s knife")).toBe("chef's knife");
	});

	it("drops an out-of-range numeric reference instead of throwing", () => {
		expect(() => cleanText("bad &#99999999; entity")).not.toThrow();
		expect(cleanText("bad &#99999999; entity")).toBe("bad entity");
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
				recipeIngredient: ["200g <b>flour</b>", "1 egg"],
				recipeInstructions: [
					{ "@type": "HowToStep", text: "Mix &nbsp;everything." },
				],
			},
			"https://example.com/pancakes",
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
		);
		expect(payload.author).toEqual(["Jane", "John"]);
	});

	it("omits the url field for a local file source", () => {
		const payload = buildImportPayload({}, undefined);
		expect(payload).not.toHaveProperty("url");
	});

	// schema.org allows a single text where a list is expected; a string
	// ingredient used to crash on `.map`, an object one on `.replace`.
	it("reads a single-string ingredient list and drops non-string entries", () => {
		expect(
			buildImportPayload({ recipeIngredient: "200g flour" }, undefined)
				.recipeIngredient,
		).toEqual(["200g flour"]);
		expect(
			buildImportPayload(
				{ recipeIngredient: ["1 egg", { name: "milk" }, 3] },
				undefined,
			).recipeIngredient,
		).toEqual(["1 egg"]);
	});

	it("ignores a non-string name or time instead of passing it to the model", () => {
		const payload = buildImportPayload(
			{ name: { "@value": "Pancakes" }, prepTime: 10 },
			undefined,
		);
		expect(payload).not.toHaveProperty("name");
		expect(payload).not.toHaveProperty("prepTime");
	});
});

describe("readInstructions", () => {
	it("reads a single text as one step", () => {
		expect(readInstructions("Mix everything.")).toEqual([
			{ text: "Mix everything." },
		]);
	});

	it("flattens sections in order, whatever form their @type takes", () => {
		expect(
			readInstructions([
				{
					"@type": ["HowToSection"],
					name: "Dough",
					itemListElement: [{ "@type": "HowToStep", text: "Mix." }, "Rest."],
				},
				{ "@type": "HowToStep", name: "Bake" },
			]),
		).toEqual([
			{ text: "Mix." },
			{ text: "Rest." },
			{ text: "Bake", name: "Bake" },
		]);
	});

	it("drops entries it cannot read", () => {
		expect(
			readInstructions([
				42,
				null,
				{ text: "untyped" },
				{ "@type": "HowToStep", text: { "@value": "Mix." } },
			]),
		).toEqual([]);
		expect(readInstructions(undefined)).toEqual([]);
	});
});

describe("injectLanguage", () => {
	it("inserts a language field when the frontmatter doesn't have one", () => {
		const result = injectLanguage(
			"---\ntitle: 'Test'\n---\n\n[Mix] @flour{200g}.\n",
			"fr",
		);
		expect(result).toContain("language: 'fr'");
		expect(result.indexOf("language: 'fr'")).toBeLessThan(
			result.indexOf("[Mix]"),
		);
	});

	it("overrides an existing (possibly wrong) language field rather than duplicating it", () => {
		const result = injectLanguage(
			"---\ntitle: 'Test'\nlanguage: 'en'\n---\n\n[Mix] @flour{200g}.\n",
			"fr",
		);
		expect(result).toContain("language: 'fr'");
		expect(result).not.toContain("language: 'en'");
		expect(result.match(/language:/g)?.length).toBe(1);
	});

	it("leaves content unchanged when there is no frontmatter block", () => {
		const content = "[Mix] @flour{200g}.\n";
		expect(injectLanguage(content, "fr")).toBe(content);
	});
});
