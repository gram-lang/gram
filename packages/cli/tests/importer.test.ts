import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchRecipe, validateGram } from "../src/services/importer";
import { GramCLIError } from "../src/errors";

// Regression tests for the two guardrails the security audit (Phase 3) identified
// on the `gram import` pipeline: fetchRecipe() is the only boundary between
// untrusted external content and the AI prompt, and validateGram() is the only
// gate between AI-generated text and a written .gram file.

const RECIPE_JSON_LD = {
	"@context": "https://schema.org",
	"@type": "Recipe",
	name: "Test Pancakes",
	recipeIngredient: ["200g flour", "1 egg"],
	recipeInstructions: ["Mix everything."],
};

let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		fetch(req) {
			const url = new URL(req.url);
			if (url.pathname === "/recipe.json") {
				return new Response(JSON.stringify(RECIPE_JSON_LD), {
					headers: { "content-type": "application/json" },
				});
			}
			if (url.pathname === "/recipe.html") {
				const html = `<html><head><script type="application/ld+json">${JSON.stringify(RECIPE_JSON_LD)}</script></head><body></body></html>`;
				return new Response(html, { headers: { "content-type": "text/html" } });
			}
			if (url.pathname === "/no-jsonld.html") {
				return new Response("<html><body>no recipe here</body></html>", {
					headers: { "content-type": "text/html" },
				});
			}
			if (url.pathname === "/not-found") {
				return new Response("not found", { status: 404 });
			}
			return new Response("not found", { status: 404 });
		},
	});
});

afterAll(() => {
	server.stop(true);
});

describe("fetchRecipe", () => {
	it("parses a direct application/json response", async () => {
		const { jsonLd } = await fetchRecipe(`${server.url}recipe.json`);
		expect(jsonLd["@type"]).toBe("Recipe");
		expect(jsonLd.name).toBe("Test Pancakes");
	});

	it("extracts JSON-LD embedded in an HTML page (the gram import <url> scraping path)", async () => {
		const { jsonLd } = await fetchRecipe(`${server.url}recipe.html`);
		expect(jsonLd["@type"]).toBe("Recipe");
		expect(jsonLd.name).toBe("Test Pancakes");
	});

	it("throws a GramCLIError when the page has no schema.org Recipe JSON-LD", async () => {
		await expect(fetchRecipe(`${server.url}no-jsonld.html`)).rejects.toThrow(
			GramCLIError,
		);
	});

	it("throws a GramCLIError on a non-2xx HTTP response instead of silently continuing", async () => {
		await expect(fetchRecipe(`${server.url}not-found`)).rejects.toThrow(
			GramCLIError,
		);
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
