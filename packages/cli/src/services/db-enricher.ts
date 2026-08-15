import pLimit from "p-limit";
import { readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parseDocument, isMap, isSeq } from "yaml";
import { z } from "zod";
import { generateObject } from "ai";
import type { LanguageModel } from "ai";
import type { IngredientData } from "@gram-lang/analyzer";
import {
	getAiLanguageInstruction,
	getCategoryLabels,
	CATEGORY_KEYS,
} from "@gram-lang/i18n";
import { withFileLock, atomicWrite } from "../core/lock";
import { resolveDbPath } from "../core/db";
import { setProvenancedField } from "../core/db-writer";
import {
	MAX_DENSITY,
	MIN_DENSITY,
	MAX_CALORIES,
	MIN_UNIT_WEIGHT,
	MAX_UNIT_WEIGHT,
} from "./db-validator";
import { GramCLIError, ExitCode } from "../errors";
import type {
	GramConfig,
	EnrichEntry,
	EnrichResult,
	EnrichWriteResult,
	EnrichOptions,
	EnrichSource,
	EnrichDecision,
} from "../types";

// Anchors realistic magnitudes on the three axes hallucination hits hardest
// (density, calorie density, unit_weight) — a liquid, a powder, and a
// countable item. Not meant to be copied: the prompt itself says so.
const FEW_SHOT_EXAMPLES = `Examples of well-calibrated responses (for magnitude reference only — always use the specific ingredient's own real-world values, never copy these numbers):
- olive oil (liquid): density 0.92 g/mL, no unit_weight (not typically countable), nutrition per 100g: calories 884, fat 100, carbs 0, protein 0.
- all-purpose flour (powder): density 0.55 g/mL, no unit_weight, nutrition per 100g: calories 364, fat 1, carbs 76, protein 10.
- egg (countable item): unit_weight 50 g, no meaningful density, nutrition per 100g: calories 155, fat 11, carbs 1, protein 13.`;

// The prompt used to present (and ask the AI to return) a translated
// *display label* ("Légumes"), which
// then got persisted verbatim as data in `ingredients.yaml` — non-portable
// across languages, and unconstrained (the prompt said "examples like", not
// a closed list, so the AI could return "Légumes frais" and nothing would
// catch it). The AI is now shown "key (label)" pairs but told to return the
// stable key; `EnrichItemSchema.category` enforces it's actually one of them.
function buildSystemPrompt(lang: string): string {
	const labels = getCategoryLabels(lang);
	const categories = CATEGORY_KEYS.map((key) => `${key} (${labels[key]})`).join(
		", ",
	);
	return `${getAiLanguageInstruction(lang)} You are a culinary database assistant. For each ingredient provided, return accurate physical and nutritional data based on standard food science references. Use SI units: density in g/mL, nutrition per 100g of edible portion. If an ingredient is typically used in countable units (like a carrot, an egg), provide its average unit_weight in grams. Before finalizing each item's nutrition, verify internally that calories are consistent with the standard Atwater estimate (4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat, 7 kcal/g alcohol) and adjust if they diverge significantly. Assign exactly one food category **key** (not the translated label) from this list: ${categories} — some ingredients in the input may already include a known "category", which is ground truth and must not be contradicted. Then provide other useful free-form "tagSuggestions" (e.g., dietary info, allergens, etc.). IMPORTANT: return every ingredient from the input, and preserve each "key" field exactly as given — do not translate, capitalize, or modify it.

${FEW_SHOT_EXAMPLES}`;
}

// Ingredient names reaching this prompt can come from arbitrary sources
// (`gram db sync` over synced recipes, `gram
// db merge` over a third-party YAML file), and `generateObject`'s schema is
// the only real backstop against a prompt-injected response — it constrains
// *shape*, so it must also constrain *plausibility*. These are the same
// bounds `db-validator.ts` reports on after the fact; reusing them here
// rejects an implausible value (a "density" of `1e9`, a `unit_weight` of
// `50000`) up front instead of writing it to a versioned file and flagging
// it later. Only bounds that are physical impossibilities live here — the
// softer, noisier heuristics in `db-validator.ts` (Atwater cross-check,
// per-category density ranges, sub-macro consistency) stay warning-only,
// since an all-or-nothing schema rejection would throw away an otherwise-good
// proposal over borderline macro math.
const EnrichItemSchema = z.object({
	key: z.string(),
	density: z.number().min(MIN_DENSITY).max(MAX_DENSITY).optional(),
	unit_weight: z.number().min(MIN_UNIT_WEIGHT).max(MAX_UNIT_WEIGHT).optional(),
	nutrition: z
		.object({
			calories: z.number().min(0).max(MAX_CALORIES),
			carbs: z.number().min(0),
			protein: z.number().min(0),
			fat: z.number().min(0),
			sugar: z.number().min(0).optional(),
			sat_fat: z.number().min(0).optional(),
			fiber: z.number().min(0).optional(),
			sodium: z.number().min(0).optional(),
		})
		.optional(),
	category: z.enum(CATEGORY_KEYS).default("other"),
	tagSuggestions: z.array(z.string()).default([]),
});

const EnrichResponseSchema = z.object({
	ingredients: z.array(EnrichItemSchema),
});

export async function enrichDb(
	db: Record<string, IngredientData>,
	config: GramConfig,
	model: LanguageModel,
	opts: EnrichOptions = {},
): Promise<EnrichResult> {
	const dbPath = resolveDbPath(config, opts.dbPathOverride);
	const field = opts.field ?? "all";
	const lang = config.language ?? "en";

	let toEnrich = Object.entries(db).filter(([, ing]) => {
		const needsDensity = !ing.physical?.density;
		const needsNutrition = !ing.nutrition;
		const needsTags = !ing.tags || ing.tags.length === 0;
		const needsCategory = !ing.category;
		if (field === "density") return needsDensity;
		if (field === "nutrition") return needsNutrition;
		if (field === "tags") return needsTags;
		if (field === "category") return needsCategory;
		return needsDensity || needsNutrition || needsTags || needsCategory;
	});

	if (opts.ingredient) {
		toEnrich = toEnrich.filter(([id]) => id === opts.ingredient);
	}

	const skipped = Object.keys(db).filter(
		(id) => !toEnrich.some(([tid]) => tid === id),
	);

	if (toEnrich.length === 0) {
		return {
			dbPath,
			totalIncomplete: 0,
			enriched: [],
			skipped,
			failed: [],
		};
	}

	const BATCH_SIZE = 8;
	const batches: Array<[string, IngredientData][]> = [];
	for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
		batches.push(toEnrich.slice(i, i + BATCH_SIZE));
	}

	const systemPrompt = buildSystemPrompt(lang);
	const limit = pLimit(5);
	const enriched: EnrichEntry[] = [];
	const failed: string[] = [];
	let batchsDone = 0;

	await Promise.all(
		batches.map((batch) =>
			limit(async () => {
				// Pass along a category we already know (unless it's the very
				// field being requested) so the AI doesn't have to re-derive it —
				// and, per the system prompt, treats it as ground truth rather
				// than a suggestion it might contradict.
				const prompt = JSON.stringify(
					batch.map(([id, ing]) => ({
						key: id,
						name: ing.name,
						...(ing.category && field !== "category"
							? { category: ing.category }
							: {}),
					})),
				);

				const batchEnriched: string[] = [];
				const batchFailed: string[] = [];

				let parsed: z.infer<typeof EnrichResponseSchema>;
				try {
					const { object } = await generateObject({
						model,
						system: systemPrompt,
						prompt,
						schema: EnrichResponseSchema,
					});
					parsed = object;
				} catch {
					for (const [id] of batch) batchFailed.push(id);
					failed.push(...batchFailed);
					opts.onBatchDone?.(
						++batchsDone,
						batches.length,
						batchEnriched,
						batchFailed,
					);
					return;
				}

				for (const item of parsed.ingredients) {
					const normalizedKey = item.key.trim().toLowerCase();
					const [id, ing] =
						batch.find(([id]) => id.toLowerCase() === normalizedKey) ?? [];
					if (!ing || !id) {
						batchFailed.push(item.key);
						continue;
					}
					const entry: EnrichEntry = {
						id: id,
						name: ing.name,
						density: item.density,
						unit_weight: item.unit_weight || undefined,
						nutrition: item.nutrition,
						category: item.category,
						tagSuggestions: item.tagSuggestions,
					};
					enriched.push(entry);
					batchEnriched.push(item.key);
				}

				for (const [id] of batch) {
					if (
						!parsed.ingredients.some(
							(i) => i.key.toLowerCase() === id.toLowerCase(),
						) &&
						!failed.includes(id)
					) {
						batchFailed.push(id);
					}
				}

				failed.push(...batchFailed);
				opts.onBatchDone?.(
					++batchsDone,
					batches.length,
					batchEnriched,
					batchFailed,
				);
			}),
		),
	);

	return {
		dbPath,
		totalIncomplete: toEnrich.length,
		enriched,
		skipped,
		failed,
	};
}

const NUTRITION_KEYS = [
	"calories",
	"carbs",
	"protein",
	"fat",
	"sugar",
	"sat_fat",
	"fiber",
	"sodium",
] as const;

function sourceOf(final: number, ai: number | undefined): EnrichSource {
	return final === ai ? "llm" : "user";
}

// Absent from this table ⇒ no comment written (the "user" case). Adding a
// future source (e.g. an OpenFoodFacts barcode lookup) only means adding a
// key here — the write logic below never needs to change.
const PROVENANCE_TAGS: Partial<Record<EnrichSource, string>> = {
	llm: " [LLM]",
};

export async function applyEnrichDecisions(
	dbPath: string,
	enriched: EnrichEntry[],
	decisions: EnrichDecision[],
): Promise<EnrichWriteResult> {
	if (decisions.length === 0) {
		return { written: false, reason: "no changes to apply" };
	}

	return withFileLock(dbPath, async (): Promise<EnrichWriteResult> => {
		// Unlike `db-sync` (which legitimately creates new entries and can
		// recover from a missing/
		// empty file), enrich only ever *updates* ingredients that must
		// already exist on disk — a missing file or an unlocatable
		// ingredients map means there is nothing to update, full stop.
		const content = await readFile(dbPath, "utf-8").catch(() => "");
		if (!content) {
			throw new GramCLIError(
				`Cannot enrich ${dbPath}: file not found or empty.`,
				ExitCode.Error,
			);
		}
		const doc = parseDocument(content);
		const root = doc.toJSON() as Record<string, unknown> | null;
		const hasWrapper = !!root && "ingredients" in root;
		const node = hasWrapper ? doc.get("ingredients") : doc.contents;

		if (!isMap(node)) {
			throw new GramCLIError(
				`Cannot enrich ${dbPath}: could not locate an ingredients map at its root (or under "ingredients:").`,
				ExitCode.Error,
			);
		}

		let count = 0;

		// Iterating over `decisions` rather than `enriched` is what guarantees
		// the Ctrl+C behavior: an entry the user was never shown has no
		// decision, so it's never visited here — not even for category/tags.
		for (const decision of decisions) {
			const entry = enriched[decision.entryIndex];
			if (!entry) continue;

			const ingNode = node.get(entry.id, true) as any;
			if (!isMap(ingNode)) continue;

			let changed = false;

			if (decision.physical?.action === "write") {
				const { density, unit_weight } = decision.physical;
				let physNode: any = ingNode.get("physical", true);
				if (!isMap(physNode)) {
					physNode = doc.createNode({}) as any;
					ingNode.set("physical", physNode);
				}
				// Defensive "only write if absent" guard — `enrichDb`'s upstream
				// filtering already guarantees this, but the write layer
				// shouldn't rely on that alone.
				if (density != null && !(physNode as any).get("density")) {
					const provenance =
						PROVENANCE_TAGS[sourceOf(density, entry.density)] ?? null;
					setProvenancedField(doc, physNode, "density", density, provenance);
					changed = true;
				}
				if (unit_weight != null && !(physNode as any).get("unit_weight")) {
					const provenance =
						PROVENANCE_TAGS[sourceOf(unit_weight, entry.unit_weight)] ?? null;
					setProvenancedField(
						doc,
						physNode,
						"unit_weight",
						unit_weight,
						provenance,
					);
					changed = true;
				}
			}

			if (
				decision.nutrition?.action === "write" &&
				decision.nutrition.nutrition &&
				!ingNode.get("nutrition")
			) {
				const values = decision.nutrition.nutrition;
				const nutrNode = doc.createNode({});
				ingNode.set("nutrition", nutrNode);
				for (const key of NUTRITION_KEYS) {
					const val = values[key];
					if (val == null) continue;
					const provenance =
						PROVENANCE_TAGS[sourceOf(val, entry.nutrition?.[key])] ?? null;
					setProvenancedField(doc, nutrNode as any, key, val, provenance);
				}
				changed = true;
			}

			if (entry.category) {
				const existingCategory = ingNode.get("category");
				if (!existingCategory) {
					ingNode.set("category", entry.category);
					changed = true;
				}
			}

			if (entry.tagSuggestions && entry.tagSuggestions.length > 0) {
				const existingTagsNode = ingNode.get("tags", true);
				const hasExistingTags =
					isSeq(existingTagsNode) && existingTagsNode.items.length > 0;
				if (!hasExistingTags) {
					ingNode.set("tags", doc.createNode(entry.tagSuggestions));
					changed = true;
				}
			}

			if (changed) count++;
		}

		if (count === 0) {
			return { written: false, reason: "no changes to apply" };
		}

		await mkdir(dirname(dbPath), { recursive: true });
		await atomicWrite(dbPath, String(doc));
		return { written: true, path: dbPath, count };
	});
}
