import { readFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { validateIngredientDatabase } from "@gram-lang/analyzer";
import type {
	IngredientData,
	IngredientValidationIssue,
} from "@gram-lang/analyzer";
import { slugify } from "@gram-lang/kitchen";
import { withFileLock, atomicWrite } from "../core/lock";

type ConflictField = "nutrition" | "physical" | "category";
export type PreferSide = "local" | "remote";

export interface MergeConflict {
	localKey: string;
	sourceKey: string;
	field: ConflictField;
	localValue: unknown;
	remoteValue: unknown;
}

interface MergeEntry {
	localKey: string;
	sourceKey: string;
	additions: Partial<IngredientData>;
	aliasAdditions: string[];
	tagAdditions: string[];
}

export interface MergeAnalysis {
	dbPath: string;
	localDb: Record<string, IngredientData>;
	toAdd: Array<{ key: string; entry: IngredientData }>;
	toEnrich: MergeEntry[];
	conflicts: MergeConflict[];
	unchanged: string[];
}

function buildLocalIndex(
	db: Record<string, IngredientData>,
): Map<string, string> {
	const index = new Map<string, string>();
	for (const [key, entry] of Object.entries(db)) {
		index.set(slugify(key), key);
		if (entry.name) index.set(slugify(entry.name), key);
		for (const alias of entry.aliases ?? []) {
			index.set(slugify(alias), key);
		}
	}
	return index;
}

function findLocalKey(
	sourceKey: string,
	sourceEntry: IngredientData,
	index: Map<string, string>,
): string | null {
	const byKey = index.get(slugify(sourceKey));
	if (byKey) return byKey;
	if (sourceEntry.name) {
		const byName = index.get(slugify(sourceEntry.name));
		if (byName) return byName;
	}
	for (const alias of sourceEntry.aliases ?? []) {
		const byAlias = index.get(slugify(alias));
		if (byAlias) return byAlias;
	}
	return null;
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
	const ka = Object.keys(a as object).sort();
	const kb = Object.keys(b as object).sort();
	if (ka.join() !== kb.join()) return false;
	return ka.every((k) =>
		deepEqual(
			(a as Record<string, unknown>)[k],
			(b as Record<string, unknown>)[k],
		),
	);
}

export interface LoadSourceDbResult {
	data: Record<string, IngredientData>;
	rejected: IngredientValidationIssue[];
}

/**
 * This used to report rejected entries itself via `log.warn` (@clack/prompts)
 * — the same architectural smell as `core/db.ts`'s `loadDb` (a non-`ui`/
 * `commands` module deciding how to display a warning). `rejected` is now
 * returned as a value; the caller (`commands/db/merge.ts`) reports it via
 * `reportRejectedIngredients` (`ui/diagnostics.ts`), like every other
 * database-loading call site.
 */
export async function loadSourceDb(
	sourcePath: string,
): Promise<LoadSourceDbResult> {
	let raw: string;
	try {
		raw = await readFile(sourcePath, "utf-8");
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		throw new Error(
			code === "ENOENT"
				? `Source file not found: ${sourcePath}`
				: `Cannot read source file: ${sourcePath}`,
		);
	}
	const parsed = parseYaml(raw) as Record<string, unknown> | null;
	const rawIngredients = (parsed?.ingredients ?? parsed) as unknown;
	const { data, rejected } = validateIngredientDatabase(rawIngredients);
	if (Object.keys(data).length === 0) {
		throw new Error(`Source database is empty: ${sourcePath}`);
	}
	return { data, rejected };
}

export async function analyzeMerge(
	localDb: Record<string, IngredientData>,
	sourceDb: Record<string, IngredientData>,
	dbPath: string,
	onlyNew = false,
): Promise<MergeAnalysis> {
	const localIndex = buildLocalIndex(localDb);

	const toAdd: MergeAnalysis["toAdd"] = [];
	const toEnrich: MergeEntry[] = [];
	const conflicts: MergeConflict[] = [];
	const unchanged: string[] = [];

	for (const [sourceKey, sourceEntry] of Object.entries(sourceDb)) {
		const localKey = findLocalKey(sourceKey, sourceEntry, localIndex);

		if (!localKey) {
			toAdd.push({ key: sourceKey, entry: sourceEntry });
			continue;
		}

		if (onlyNew) {
			unchanged.push(localKey);
			continue;
		}

		const local = localDb[localKey]!;
		const enrichEntry: MergeEntry = {
			localKey,
			sourceKey,
			additions: {},
			aliasAdditions: [],
			tagAdditions: [],
		};
		let hasChange = false;

		// Arrays: always union (no conflict)
		const aliasUnion = [
			...new Set([...(local.aliases ?? []), ...(sourceEntry.aliases ?? [])]),
		];
		const newAliases = aliasUnion.filter(
			(a) => !(local.aliases ?? []).includes(a),
		);
		if (newAliases.length > 0) {
			enrichEntry.aliasAdditions = newAliases;
			hasChange = true;
		}

		const tagUnion = [
			...new Set([...(local.tags ?? []), ...(sourceEntry.tags ?? [])]),
		];
		const newTags = tagUnion.filter((t) => !(local.tags ?? []).includes(t));
		if (newTags.length > 0) {
			enrichEntry.tagAdditions = newTags;
			hasChange = true;
		}

		// Scalar: fill-in if local missing, conflict if both present and differ
		if (sourceEntry.category !== undefined) {
			if (!local.category) {
				enrichEntry.additions.category = sourceEntry.category;
				hasChange = true;
			} else if (local.category !== sourceEntry.category) {
				conflicts.push({
					localKey,
					sourceKey,
					field: "category",
					localValue: local.category,
					remoteValue: sourceEntry.category,
				});
			}
		}

		// Objects: fill-in if local missing, conflict if both present and not equal
		for (const field of ["nutrition", "physical"] as const) {
			if (sourceEntry[field] !== undefined) {
				if (!local[field]) {
					enrichEntry.additions[field] = sourceEntry[field] as any;
					hasChange = true;
				} else if (!deepEqual(local[field], sourceEntry[field])) {
					conflicts.push({
						localKey,
						sourceKey,
						field,
						localValue: local[field],
						remoteValue: sourceEntry[field],
					});
				}
			}
		}

		if (hasChange) {
			toEnrich.push(enrichEntry);
		} else {
			unchanged.push(localKey);
		}
	}

	return { dbPath, localDb, toAdd, toEnrich, conflicts, unchanged };
}

export async function applyMerge(
	analysis: MergeAnalysis,
	resolvedConflicts: Map<string, PreferSide>,
	dryRun = false,
): Promise<void> {
	if (dryRun) return;

	const { dbPath, localDb, toAdd, toEnrich, conflicts } = analysis;

	await withFileLock(dbPath, async () => {
		const db: Record<string, IngredientData> = { ...localDb };

		for (const { key, entry } of toAdd) {
			db[key] = entry;
		}

		// Apply enrichment (fill-in + array unions)
		for (const {
			localKey,
			additions,
			aliasAdditions,
			tagAdditions,
		} of toEnrich) {
			const local = { ...db[localKey]! };
			Object.assign(local, additions);
			if (aliasAdditions.length > 0) {
				local.aliases = [
					...new Set([...(local.aliases ?? []), ...aliasAdditions]),
				];
			}
			if (tagAdditions.length > 0) {
				local.tags = [...new Set([...(local.tags ?? []), ...tagAdditions])];
			}
			db[localKey] = local;
		}

		// Apply resolved conflicts
		for (const conflict of conflicts) {
			const side = resolvedConflicts.get(
				`${conflict.localKey}:${conflict.field}`,
			);
			if (!side || side === "local") continue;
			const local = { ...db[conflict.localKey]! };
			(local as Record<string, unknown>)[conflict.field] = conflict.remoteValue;
			db[conflict.localKey] = local;
		}

		const sorted = Object.keys(db)
			.sort()
			.reduce(
				(acc, k) => {
					acc[k] = db[k]!;
					return acc;
				},
				{} as Record<string, IngredientData>,
			);

		await atomicWrite(
			dbPath,
			stringifyYaml({ ingredients: sorted }, { lineWidth: 120 }),
		);
	});
}
