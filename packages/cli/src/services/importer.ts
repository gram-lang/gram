import { readFile } from "node:fs/promises";
import { generateText } from "ai";
import type { LanguageModel, SystemModelMessage } from "ai";
import { getAST } from "@gram-lang/parser";
import { compile, warningSeverity, type Warning } from "@gram-lang/kitchen";
import { formatGram } from "@gram-lang/format";
import { getAiLanguageInstruction } from "@gram-lang/i18n";
import { GramCLIError, ExitCode, getErrorMessage } from "../errors";
import { assertPublicUrl } from "../core/ssrf";
import type { ImportResult } from "../types";
import { GRAM_SPEC_PROMPT } from "../prompts/gram-spec";

// ── JSON-LD extraction ────────────────────────────────────────────────────────

function extractRecipeJsonLd(html: string): object {
	const blocks: object[] = [];
	const re =
		/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	let match = re.exec(html);
	while (match !== null) {
		try {
			const parsed = JSON.parse(match[1] ?? "");
			blocks.push(parsed);
		} catch {
			// skip malformed blocks
		}
		match = re.exec(html);
	}

	for (const block of blocks) {
		const recipe = findRecipe(block);
		if (recipe) return recipe;
	}

	throw new GramCLIError(
		"No schema.org/Recipe JSON-LD found on this page. Try downloading the page and passing the JSON-LD directly.",
		ExitCode.Error,
	);
}

function findRecipe(obj: any): object | null {
	if (!obj) return null;
	if (obj["@type"] === "Recipe") return obj;
	if (Array.isArray(obj["@graph"])) {
		for (const node of obj["@graph"]) {
			if (node["@type"] === "Recipe") return node;
		}
	}
	if (Array.isArray(obj)) {
		for (const item of obj) {
			const r = findRecipe(item);
			if (r) return r;
		}
	}
	return null;
}

function flattenInstructions(
	instructions: any[],
): Array<{ text: string; name?: string }> {
	const steps: Array<{ text: string; name?: string }> = [];
	for (const ins of instructions) {
		if (typeof ins === "string") {
			steps.push({ text: ins });
		} else if (ins["@type"] === "HowToStep") {
			steps.push({ text: ins.text ?? ins.name ?? "", name: ins.name });
		} else if (
			ins["@type"] === "HowToSection" &&
			Array.isArray(ins.itemListElement)
		) {
			steps.push(...flattenInstructions(ins.itemListElement));
		}
	}
	return steps;
}

// ── Source fetching ───────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB — a recipe page is never legitimately bigger than this
const MAX_REDIRECTS = 5;

// `redirect: "manual"` + a manual loop, re-running `assertPublicUrl` on
// every hop, instead of leaving
// redirects to `fetch`'s default behavior — a URL that's public on the first
// request can still redirect (or DNS-rebind) to an internal address, and a
// check done only once up front would never see that.
async function fetchWithSsrfGuard(url: string): Promise<Response> {
	let currentUrl = url;
	for (let i = 0; i <= MAX_REDIRECTS; i++) {
		await assertPublicUrl(currentUrl);
		const res = await fetch(currentUrl, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			redirect: "manual",
		});
		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get("location");
			if (!location) {
				throw new GramCLIError(
					`Redirect from ${currentUrl} had no Location header.`,
					ExitCode.Error,
				);
			}
			currentUrl = new URL(location, currentUrl).toString();
			continue;
		}
		return res;
	}
	throw new GramCLIError(
		`Too many redirects (> ${MAX_REDIRECTS}) fetching ${url}.`,
		ExitCode.Error,
	);
}

// Reads a response body with a hard size cap, regardless of what Content-Length
// claims (it can be absent or wrong) — protects against a slow/huge/malicious
// response tying up `gram import` indefinitely or exhausting memory.
async function readBodyWithLimit(res: Response): Promise<string> {
	const reader = res.body?.getReader();
	if (!reader) return res.text();

	const decoder = new TextDecoder();
	let result = "";
	let received = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.byteLength;
		if (received > MAX_RESPONSE_BYTES) {
			await reader.cancel();
			throw new GramCLIError(
				`Response exceeds the ${MAX_RESPONSE_BYTES / (1024 * 1024)}MB limit.`,
				ExitCode.Error,
			);
		}
		result += decoder.decode(value, { stream: true });
	}
	result += decoder.decode();
	return result;
}

type RecipeFetchResult = { jsonLd: any };

// Split out from fetchRecipe so the response-parsing logic (content-type
// dispatch, HTML scraping) is testable with plain fixture strings, without
// needing a real HTTP fetch — a real fetch to a test server is now also a
// fetch to a loopback address, which `fetchWithSsrfGuard` correctly refuses
// (see ssrf.test.ts), so it's no longer a viable way to test this part.
export function parseRecipeResponse(
	body: string,
	contentType: string,
): RecipeFetchResult {
	if (contentType.includes("json")) {
		return { jsonLd: JSON.parse(body) };
	}
	return { jsonLd: extractRecipeJsonLd(body) };
}

export async function fetchRecipe(source: string): Promise<RecipeFetchResult> {
	if (source.startsWith("http://") || source.startsWith("https://")) {
		let body: string;
		let contentType: string;
		try {
			// The same AbortSignal covers both the connection and the body read below
			// (per the fetch spec, an in-flight body read aborts too), so both must
			// share this try/catch — otherwise a timeout that fires mid-body-read
			// leaks the raw "TimeoutError" instead of this friendly message.
			const res = await fetchWithSsrfGuard(source);
			if (!res.ok)
				throw new GramCLIError(
					`HTTP ${res.status} fetching ${source}`,
					ExitCode.Error,
				);
			contentType = res.headers.get("content-type") ?? "";
			body = await readBodyWithLimit(res);
		} catch (err) {
			if (err instanceof Error && err.name === "TimeoutError") {
				throw new GramCLIError(
					`Timed out fetching ${source} after ${FETCH_TIMEOUT_MS / 1000}s.`,
					ExitCode.Error,
				);
			}
			throw err;
		}
		return parseRecipeResponse(body, contentType);
	}

	const content = await readFile(source, "utf-8");
	const parsed = JSON.parse(content);
	const recipe = findRecipe(parsed);
	if (!recipe)
		throw new GramCLIError(
			"No schema.org/Recipe found in the provided JSON file.",
			ExitCode.Error,
		);
	return { jsonLd: recipe };
}

// ── Prompt payload ────────────────────────────────────────────────────────────

// Strips markup/entities real-world recipe sites embed in JSON-LD text fields
// (WordPress recipe plugins in particular) so neither tokens nor the model's
// attention are spent on it.
function cleanText(text: string): string {
	return text
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#0*39;|&apos;/gi, "'")
		.replace(/\s+/g, " ")
		.trim();
}

// schema.org allows `author` to be a string, a Person/Organization object, or
// an array of either — normalize all three shapes to what the spec prompt
// actually asks for (a plain name or array of names).
function extractAuthor(author: any): string | string[] | undefined {
	if (!author) return undefined;
	if (typeof author === "string") return cleanText(author);
	if (Array.isArray(author)) {
		const names = author.map(extractAuthor).filter((n): n is string => !!n);
		return names.length > 0 ? names : undefined;
	}
	if (typeof author === "object" && typeof author.name === "string") {
		return cleanText(author.name);
	}
	return undefined;
}

// Raw JSON-LD from real sites drags along fields the spec prompt never asks
// for and that can dwarf the recipe itself in size — `image` (often several
// URLs or objects), `aggregateRating`, `review`/`reviews` (can be dozens of
// full-text entries), `video`, `nutrition`, `@context`, `potentialAction`...
// None of it helps write .gram. This keeps only what SECTION 1 (FRONTMATTER)
// and SECTION 2/3 of the spec actually use, pre-cleaned of markup noise.
export function buildImportPayload(
	recipe: any,
	sourceUrl: string | undefined,
	rawIngredients: string[],
	instructions: Array<{ text: string; name?: string }>,
): Record<string, unknown> {
	const payload: Record<string, unknown> = {
		recipeIngredient: rawIngredients.map(cleanText),
		recipeInstructions: instructions.map((i) => ({
			text: cleanText(i.text),
			...(i.name ? { name: cleanText(i.name) } : {}),
		})),
	};
	if (typeof recipe.name === "string") payload.name = cleanText(recipe.name);
	if (typeof recipe.description === "string")
		payload.description = cleanText(recipe.description);
	const author = extractAuthor(recipe.author);
	if (author) payload.author = author;
	if (sourceUrl) payload.url = sourceUrl;
	if (typeof recipe.recipeCategory === "string")
		payload.recipeCategory = cleanText(recipe.recipeCategory);
	if (typeof recipe.keywords === "string")
		payload.keywords = cleanText(recipe.keywords);
	if (recipe.recipeYield != null) payload.recipeYield = recipe.recipeYield;
	if (typeof recipe.prepTime === "string") payload.prepTime = recipe.prepTime;
	if (typeof recipe.cookTime === "string") payload.cookTime = recipe.cookTime;
	if (typeof recipe.totalTime === "string")
		payload.totalTime = recipe.totalTime;
	return payload;
}

// ── AI import ─────────────────────────────────────────────────────────────────

const AI_MAX_RETRIES = 2;

type CompileCheck =
	| { ok: true; warnings: Warning[] }
	| { ok: false; error: string };

function checkGram(text: string): CompileCheck {
	try {
		const ast = getAST(text);
		const compiled = compile(ast);
		return { ok: true, warnings: compiled.warnings };
	} catch (err) {
		return { ok: false, error: getErrorMessage(err) };
	}
}

// Only `warningSeverity[code] === "error"` (undefined references, scope
// conflicts...) is worth spending an AI retry on — the same bar `gram check`
// uses by default. Nutritional/estimation gaps and incomplete-but-valid
// annotations (e.g. a new ingredient not yet in the user's database) are
// expected on a fresh import and aren't defects the AI can meaningfully fix;
// retrying on them just burns tokens without changing the outcome.
export function validateGram(text: string): string[] {
	const result = checkGram(text);
	if (!result.ok) return [result.error];
	return result.warnings
		.filter((w) => warningSeverity[w.code] === "error")
		.map((w) => w.message);
}

// Every compiler warning left in the final output, not just the error-severity
// ones validateGram() retries on — this is what gets reported to the user
// after import (they were never worth an AI retry, but the user should still
// see them, e.g. "not found in database" for a freshly imported ingredient).
export function collectAllWarnings(text: string): string[] {
	const result = checkGram(text);
	if (!result.ok) return [result.error];
	return result.warnings.map((w) => w.message);
}

// Sets the frontmatter `language` field to the actual configured target
// language deterministically, rather than leaving it to the AI to notice and
// fill in on its own — we already know this value with certainty (it's the
// same `lang` used to instruct the AI), there's nothing for it to infer.
export function injectLanguage(text: string, lang: string): string {
	const match = text.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return text;
	const frontmatter = match[1]!;
	const languageLine = `language: '${lang}'`;
	const newFrontmatter = /^language\s*:.*$/m.test(frontmatter)
		? frontmatter.replace(/^language\s*:.*$/m, languageLine)
		: `${frontmatter}\n${languageLine}`;
	return text.replace(match[0], `---\n${newFrontmatter}\n---`);
}

function stripFences(text: string): string {
	return text
		.trim()
		.replace(/^```[\w]*\n?/, "")
		.replace(/\n?```$/, "")
		.trim();
}

export async function importWithAI(
	source: string,
	model: LanguageModel,
	lang = "en",
): Promise<ImportResult> {
	const { jsonLd } = await fetchRecipe(source);
	const recipe: any = findRecipe(jsonLd) ?? jsonLd;

	const rawIngredients: string[] = recipe.recipeIngredient ?? [];
	const instructions = flattenInstructions(recipe.recipeInstructions ?? []);
	const sourceUrl = /^https?:\/\//.test(source) ? source : undefined;
	const payload = buildImportPayload(
		recipe,
		sourceUrl,
		rawIngredients,
		instructions,
	);
	// The language instruction is repeated at both ends of the spec: a single
	// mention at the top gets drowned out by ~600 lines of English syntax
	// examples in between, and the model tends to anchor on the examples it
	// saw most recently rather than an instruction from the start of the prompt.
	const languageInstruction = getAiLanguageInstruction(lang);
	const systemText = `${languageInstruction}\n\n${GRAM_SPEC_PROMPT}\n\n${languageInstruction}`;
	// SystemModelMessage (rather than a plain string) so providerOptions can mark
	// this large, byte-identical-across-calls prompt as cacheable. Anthropic reads
	// its own namespace and caches the prefix; other providers ignore the key they
	// don't recognize, so this is safe to send unconditionally regardless of which
	// provider `model` actually is.
	const system: SystemModelMessage = {
		role: "system",
		content: systemText,
		providerOptions: {
			anthropic: { cacheControl: { type: "ephemeral" } },
		},
	};

	let gramContent: string;
	try {
		const { text } = await generateText({
			model,
			temperature: 0,
			system,
			prompt: `Convert this recipe to Gram format:\n\n${JSON.stringify(payload, null, 2)}`,
		});
		gramContent = stripFences(text);

		for (let attempt = 0; attempt < AI_MAX_RETRIES; attempt++) {
			const errors = validateGram(gramContent);
			if (errors.length === 0) break;

			const errorList = errors.map((e, i) => `${i + 1}. ${e}`).join("\n");
			const { text: fixed } = await generateText({
				model,
				temperature: 0,
				system,
				prompt: `The following .gram file has validation errors. Fix them and output only the corrected .gram content.\n\nErrors:\n${errorList}\n\nFile:\n${gramContent}`,
			});
			gramContent = stripFences(fixed);
		}

		gramContent = injectLanguage(gramContent, lang);

		// Formatting (spacing, trailing zeros, blank lines...) is deterministic —
		// no need to spend another AI call asking the model to fix it when
		// `@gram-lang/format` already does this exactly and for free.
		gramContent = formatGram(gramContent).content;
	} catch (err) {
		throw new GramCLIError(
			`AI import failed: ${getErrorMessage(err)}`,
			ExitCode.Error,
		);
	}

	return {
		gramContent,
		title: recipe.name ?? "Untitled",
		ingredientCount: rawIngredients.length,
		stepCount: instructions.length,
		parseWarnings: collectAllWarnings(gramContent),
	};
}
