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
import { MAX_DENSITY, MAX_CALORIES } from "./db-validator";
import { GramCLIError, ExitCode } from "../errors";
import type {
	GramConfig,
	EnrichEntry,
	EnrichResult,
	EnrichWriteResult,
	EnrichOptions,
} from "../types";

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
	return `${getAiLanguageInstruction(lang)} You are a culinary database assistant. For each ingredient provided, return accurate physical and nutritional data based on standard food science references. Use SI units: density in g/mL, nutrition per 100g of edible portion. If an ingredient is typically used in countable units (like a carrot, an egg), provide its average unit_weight in grams. Assign exactly one food category **key** (not the translated label) from this list: ${categories}. Then provide other useful free-form "tagSuggestions" (e.g., dietary info, allergens, etc.). IMPORTANT: return every ingredient from the input, and preserve each "key" field exactly as given — do not translate, capitalize, or modify it.`;
}

// Ingredient names reaching this prompt can come from arbitrary sources
// (`gram db sync` over synced recipes, `gram
// db merge` over a third-party YAML file), and `generateObject`'s schema is
// the only real backstop against a prompt-injected response — it constrains
// *shape*, so it must also constrain *plausibility*. MAX_DENSITY/MAX_CALORIES
// are the same bounds `db-validator.ts` reports on after the fact; reusing
// them here rejects an implausible value (a "density" of `1e9`) up front
// instead of writing it to a versioned file and flagging it later.
const EnrichItemSchema = z.object({
	key: z.string(),
	density: z.number().positive().max(MAX_DENSITY).optional(),
	unit_weight: z.number().optional(),
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
			write: { written: false, reason: "nothing to enrich" },
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
				const prompt = JSON.stringify(
					batch.map(([id, ing]) => ({ key: id, name: ing.name })),
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

	let write: EnrichWriteResult;
	if (opts.dryRun) {
		write = { written: false, reason: "dry run" };
	} else if (enriched.length === 0) {
		write = {
			written: false,
			reason: "no ingredient produced a usable AI response",
		};
	} else {
		write = await withFileLock(dbPath, async (): Promise<EnrichWriteResult> => {
			// Unlike `db-sync` (which legitimately creates new entries and can
			// recover from a missing/
			// empty file), enrich only ever *updates* ingredients that must
			// already exist on disk — a missing file or an unlocatable
			// ingredients map means there is nothing to update, full stop. This
			// used to silently skip the write while still returning `enriched`
			// populated, so the caller reported "Updated" against an unchanged
			// file. Now a hard error, same as `db-sync.ts`'s equivalent case
			// (the audit's own "correct, to generalize" reference).
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

			for (const entry of enriched) {
				const ingNode = node.get(entry.id, true) as any;
				if (!isMap(ingNode)) continue;

				if (entry.density != null || entry.unit_weight != null) {
					const physNode = ingNode.get("physical", true);
					if (!isMap(physNode)) {
						const data: any = {};
						if (entry.density != null) data.density = entry.density;
						if (entry.unit_weight != null) data.unit_weight = entry.unit_weight;
						ingNode.set("physical", doc.createNode(data));
					} else {
						if (entry.density != null && !physNode.get("density"))
							(physNode as any).set("density", entry.density);
						if (entry.unit_weight != null && !physNode.get("unit_weight"))
							(physNode as any).set("unit_weight", entry.unit_weight);
					}
				}

				if (entry.category) {
					const existingCategory = ingNode.get("category");
					if (!existingCategory) {
						ingNode.set("category", entry.category);
					}
				}

				if (entry.tagSuggestions && entry.tagSuggestions.length > 0) {
					const existingTagsNode = ingNode.get("tags", true);
					const hasExistingTags =
						isSeq(existingTagsNode) && existingTagsNode.items.length > 0;
					if (!hasExistingTags) {
						ingNode.set("tags", doc.createNode(entry.tagSuggestions));
					}
				}

				if (entry.nutrition != null && !ingNode.get("nutrition")) {
					ingNode.set("nutrition", doc.createNode(entry.nutrition));
				}
			}
			await mkdir(dirname(dbPath), { recursive: true });
			await atomicWrite(dbPath, String(doc));
			return { written: true, path: dbPath, count: enriched.length };
		});
	}

	return {
		dbPath,
		totalIncomplete: toEnrich.length,
		enriched,
		skipped,
		failed,
		write,
	};
}
