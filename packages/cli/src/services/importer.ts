import { readFile } from "node:fs/promises";
import { generateText } from "ai";
import type { LanguageModel, SystemModelMessage } from "ai";
import {
	warningSeverity,
	type CompilationResult,
	type Warning,
} from "@gram-lang/kitchen";
import type { AnalysisResult, IngredientData } from "@gram-lang/analyzer";
import { formatGram } from "@gram-lang/format";
import { getAiLanguageInstruction } from "@gram-lang/i18n";
import { GramCLIError, ExitCode, getErrorMessage } from "../errors";
import { fetchTextWithSsrfGuard } from "../core/http";
import { findWrittenIngredients } from "../core/gram-tokens";
import { runPipelineFromSource } from "../core/pipeline";
import type { ImportResult } from "../types";
import { GRAM_SPEC_PROMPT } from "../prompts/gram-spec";
import {
	VIDEO_IMPORT_PREAMBLE,
	VIDEO_IMPORT_REMINDER,
	buildVideoContext,
} from "../prompts/video-import";
import type { YoutubeMetadata } from "./youtube";

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
		const { body, contentType } = await fetchTextWithSsrfGuard(source);
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

// A malformed/malicious numeric reference (out-of-range code point) must not
// crash the whole import — fromCodePoint() throws on those, so this drops the
// entity rather than propagating the exception.
function decodeNumericEntity(codePoint: number): string {
	try {
		return String.fromCodePoint(codePoint);
	} catch {
		return "";
	}
}

// Strips markup/entities real-world recipe sites embed in JSON-LD text fields
// (WordPress recipe plugins in particular). Named entities cover the common
// ASCII ones; numeric references (decimal and hex) are decoded generically
// instead of one at a time, since those are how sites most often encode
// accented characters and typographic punctuation — especially relevant for
// non-English content. Named entities are decoded first so a double-encoded
// reference like "&amp;#39;" (literal "&" followed by "#39;") still resolves
// instead of surviving as text.
export function cleanText(text: string): string {
	return text
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&apos;/gi, "'")
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
			decodeNumericEntity(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, dec) =>
			decodeNumericEntity(Number.parseInt(dec, 10)),
		)
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
	| {
			ok: true;
			warnings: Warning[];
			compiled: CompilationResult;
			analyzed: AnalysisResult | null;
	  }
	| { ok: false; error: string };

// The single "compile and inspect" path. validateGram, collectAllWarnings,
// findLostIngredients and the analyzer report all go through here rather than
// each running their own getAST + compile, so they can never disagree about
// what the file contains. Delegates to the same runPipelineFromSource every
// other command uses — an imported recipe gets read exactly as `gram check`
// would read it once written.
export function checkGram(
	text: string,
	db?: Record<string, IngredientData> | null,
): CompileCheck {
	try {
		const { compiled, analyzed } = runPipelineFromSource(text, {
			db,
			skipAnalyzer: !db,
		});
		return { ok: true, warnings: compiled.warnings, compiled, analyzed };
	} catch (err) {
		return { ok: false, error: getErrorMessage(err) };
	}
}

/**
 * What the physical layer could not work out, once a database is available:
 * ingredients it has never heard of, and a total mass it could not complete.
 *
 * Reported, never retried. These are gaps in the *data* — an ingredient absent
 * from the user's `ingredients.yaml`, a volume with no density — not defects
 * in the AI's writing, so another generation would produce the same result at
 * full price. Without a database there is nothing to check and this is empty.
 */
export function collectAnalysisGaps(
	text: string,
	db?: Record<string, IngredientData> | null,
): string[] {
	if (!db) return [];
	return gapsFrom(checkGram(text, db));
}

function gapsFrom(result: CompileCheck): string[] {
	if (!result.ok || !result.analyzed) return [];

	const gaps: string[] = [];
	const missing = result.analyzed.missingIngredients;
	if (missing.length > 0) {
		gaps.push(`not in your database: ${missing.join(", ")}`);
	}

	const { massStatus, missingMassIngredients } = result.analyzed.result.metrics;
	if (massStatus === "incomplete") {
		const which =
			missingMassIngredients.length > 0
				? ` (${missingMassIngredients.join(", ")})`
				: "";
		gaps.push(`no usable mass for some ingredients${which}`);
	}
	return gaps;
}

/**
 * Ingredients written in the file that the compiler never registered.
 *
 * A non-empty result means content was silently swallowed. The case this was
 * built for: `@flour{} // TODO: quantity unknown, @sugar{}, @salt{}` — `//`
 * comments to end of line, so sugar and salt vanish. The file compiles, no
 * warning fires, and the shopping list is quietly short two ingredients. It
 * happened on two of six spike imports, losing four and three ingredients.
 *
 * Validated against ground truth before being trusted: it finds exactly those
 * seven, and reports nothing on the other four spike outputs, the repo's
 * example recipes, or any of the 63 conformance cases.
 */
export function findLostIngredients(text: string): string[] {
	return lostFrom(checkGram(text), text);
}

function lostFrom(result: CompileCheck, text: string): string[] {
	if (!result.ok) return [];

	const registered = new Set(Object.keys(result.compiled.registry.ingredients));
	const seen = new Set<string>();
	const lost: string[] = [];
	for (const written of findWrittenIngredients(text)) {
		if (registered.has(written.id) || seen.has(written.id)) continue;
		seen.add(written.id);
		lost.push(`${written.name} (line ${written.line})`);
	}
	return lost;
}

// Only `warningSeverity[code] === "error"` (undefined references, scope
// conflicts...) is worth spending an AI retry on — the same bar `gram check`
// uses by default. Nutritional/estimation gaps and incomplete-but-valid
// annotations (e.g. a new ingredient not yet in the user's database) are
// expected on a fresh import and aren't defects the AI can meaningfully fix;
// retrying on them just burns tokens without changing the outcome.
export function validateGram(text: string): string[] {
	return errorsFrom(checkGram(text));
}

function errorsFrom(result: CompileCheck): string[] {
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
	return allWarningsFrom(checkGram(text));
}

function allWarningsFrom(result: CompileCheck): string[] {
	if (!result.ok) return [result.error];
	return result.warnings.map((w) => w.message);
}

/**
 * Every verdict on the finished file, from one compile.
 *
 * The four public helpers above each run their own `checkGram`, which is right
 * for callers asking a single question (the repair loop only wants the errors).
 * The end of an import wants all four at once, and compiling the same text four
 * times to get them would be silly.
 */
export function inspectImport(
	text: string,
	db?: Record<string, IngredientData> | null,
): Pick<
	ImportResult,
	"parseWarnings" | "unresolvedErrors" | "lostIngredients" | "analysisGaps"
> {
	const result = checkGram(text, db);
	return {
		parseWarnings: allWarningsFrom(result),
		unresolvedErrors: errorsFrom(result),
		lostIngredients: lostFrom(result, text),
		analysisGaps: db ? gapsFrom(result) : [],
	};
}

// Sets a frontmatter field to a value we know for certain, or removes it when
// we know we have nothing to put there. Assumes single-line values, which is
// what the spec prompt asks for on every field this is used with.
//
// Removal is as important as setting. The spec prompt illustrates frontmatter
// with `source: ['https://example.com/recipe']`, and a model with no URL to
// hand copies the placeholder rather than omitting the field — four of the six
// spike imports came back sourced to example.com, with invented authors to
// match. A fabricated provenance is worse than none.
export function setFrontmatterField(
	text: string,
	key: string,
	value: string | null,
): string {
	const match = text.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return text;
	const frontmatter = match[1] as string;
	const lineRe = new RegExp(`^${key}\\s*:.*$`, "m");

	let updated: string;
	if (value === null) {
		if (!lineRe.test(frontmatter)) return text;
		updated = frontmatter
			.replace(lineRe, "")
			.replace(/\n{2,}/g, "\n")
			.trim();
	} else {
		const line = `${key}: ${value}`;
		updated = lineRe.test(frontmatter)
			? frontmatter.replace(lineRe, line)
			: `${frontmatter}\n${line}`;
	}
	return text.replace(match[0], `---\n${updated}\n---`);
}

/** Single-quoted YAML scalar, with the quote doubled as YAML requires. */
function yamlString(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

// Sets the frontmatter `language` field to the actual configured target
// language deterministically, rather than leaving it to the AI to notice and
// fill in on its own — we already know this value with certainty (it's the
// same `lang` used to instruct the AI), there's nothing for it to infer.
export function injectLanguage(text: string, lang: string): string {
	return setFrontmatterField(text, "language", `'${lang}'`);
}

/**
 * Replace the model's `source:` and `author:` with what the source data
 * actually said — or strip them when it said nothing. Same reasoning as
 * injectLanguage: these are facts we hold, not inferences to delegate.
 */
export function injectProvenance(
	text: string,
	provenance: { sourceUrl?: string; author?: string | string[] },
): string {
	const { sourceUrl, author } = provenance;

	let out = setFrontmatterField(
		text,
		"source",
		sourceUrl ? `[${yamlString(sourceUrl)}]` : null,
	);

	const authorValue = Array.isArray(author)
		? author.length > 0
			? `[${author.map(yamlString).join(", ")}]`
			: null
		: author
			? yamlString(author)
			: null;

	out = setFrontmatterField(out, "author", authorValue);
	return out;
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
	opts: {
		lang?: string;
		/** Enables the analyzer report — without it there is nothing to check quantities against. */
		db?: Record<string, IngredientData> | null;
	} = {},
): Promise<ImportResult> {
	const { lang = "en", db = null } = opts;
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
	const system = buildSystemPrompt(lang);

	const gramContent = await generateAndFinalize({
		model,
		system,
		firstCall: () =>
			generateText({
				model,
				temperature: 0,
				system,
				prompt: `Convert this recipe to Gram format:\n\n${JSON.stringify(payload, null, 2)}`,
			}),
		lang,
		sourceUrl,
		author: extractAuthor(recipe.author),
	});

	return {
		gramContent,
		title: recipe.name ?? "Untitled",
		ingredientCount: rawIngredients.length,
		stepCount: instructions.length,
		...inspectImport(gramContent, db),
	};
}

/**
 * The system prompt: the shared .gram spec, wrapped in whatever framing the
 * source needs.
 *
 * The language instruction is repeated at both ends. A single mention at the
 * top gets drowned out by ~600 lines of English syntax examples in between,
 * and the model anchors on what it saw most recently. `framing` is composed
 * the same way and for the same reason — see prompts/video-import.ts, where
 * putting the source framing *after* the spec measurably degraded the writing.
 *
 * SystemModelMessage (rather than a plain string) so providerOptions can mark
 * this large, byte-identical-across-calls prompt as cacheable. Anthropic reads
 * its own namespace and caches the prefix; other providers ignore the key they
 * don't recognize, so this is safe to send unconditionally regardless of which
 * provider `model` actually is.
 */
function buildSystemPrompt(
	lang: string,
	framing?: { preamble: string; reminder: string },
): SystemModelMessage {
	const languageInstruction = getAiLanguageInstruction(lang);
	const content = [
		languageInstruction,
		framing?.preamble,
		GRAM_SPEC_PROMPT,
		framing?.reminder,
		languageInstruction,
	]
		.filter(Boolean)
		.join("\n\n");

	return {
		role: "system",
		content,
		providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
	};
}

/**
 * Generate, repair, then apply the deterministic passes. Shared by the JSON-LD
 * and video paths: only the first call differs between them, and duplicating
 * the loop would mean the video path silently missing a fix made to this one.
 */
async function generateAndFinalize(opts: {
	model: LanguageModel;
	system: SystemModelMessage;
	firstCall: () => Promise<{ text: string }>;
	lang: string;
	sourceUrl?: string;
	author?: string | string[];
}): Promise<string> {
	const { model, system, firstCall, lang, sourceUrl, author } = opts;

	try {
		let gramContent = stripFences((await firstCall()).text);

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
		// Provenance comes from the source data, never from the model — see
		// injectProvenance. Runs before formatGram so the result is formatted.
		gramContent = injectProvenance(gramContent, { sourceUrl, author });

		// Formatting (spacing, trailing zeros, blank lines...) is deterministic —
		// no need to spend another AI call asking the model to fix it when
		// `@gram-lang/format` already does this exactly and for free.
		return formatGram(gramContent).content;
	} catch (err) {
		throw new GramCLIError(
			`AI import failed: ${getErrorMessage(err)}`,
			ExitCode.Error,
		);
	}
}

// ── Video import ──────────────────────────────────────────────────────────────

/**
 * Import from a YouTube video, read by Gemini directly.
 *
 * Everything after generation is the JSON-LD path's: the same repair loop, the
 * same deterministic passes, and the same integrity checks — which matter more
 * here, not less, since a video states far fewer quantities than a written
 * recipe and gives a model more room to fill gaps by invention.
 *
 * The URL is handed over as `fileData.fileUri`; @ai-sdk/google only does that
 * for the canonical `watch?v=` form, which is why parseYoutubeUrl exists.
 */
export async function importVideoWithAI(
	meta: YoutubeMetadata,
	model: LanguageModel,
	opts: {
		lang?: string;
		db?: Record<string, IngredientData> | null;
	} = {},
): Promise<ImportResult> {
	const { lang = "en", db = null } = opts;

	const system = buildSystemPrompt(lang, {
		preamble: VIDEO_IMPORT_PREAMBLE,
		reminder: VIDEO_IMPORT_REMINDER,
	});
	const context = buildVideoContext(meta);

	const gramContent = await generateAndFinalize({
		model,
		system,
		firstCall: () =>
			generateText({
				model,
				temperature: 0,
				system,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: [
									"Watch this cooking video and convert it to Gram format.",
									context,
								]
									.filter(Boolean)
									.join("\n\n"),
							},
							{
								type: "file",
								data: new URL(meta.canonicalUrl),
								mediaType: "video/mp4",
							},
						],
					},
				],
				providerOptions: {
					// Roughly 100 tokens/second instead of ~300. A recipe video is
					// read for its captions, packages and measuring jugs, not for
					// fine detail — the spike found low resolution read on-screen
					// gram values correctly, including on a wordless channel.
					google: { mediaResolution: "MEDIA_RESOLUTION_LOW" },
				},
			}),
		lang,
		sourceUrl: meta.canonicalUrl,
		author: meta.author,
	});

	return {
		gramContent,
		title: meta.title ?? "Untitled",
		// A video has no ingredient list to count against; these are what the
		// model produced, not what the source declared.
		ingredientCount: findWrittenIngredients(gramContent).length,
		stepCount: (gramContent.match(/^\[/gm) ?? []).length,
		...inspectImport(gramContent, db),
	};
}
