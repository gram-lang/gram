import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IngredientData } from "@gram-lang/analyzer";

let counter = 0;

/**
 * Writes `content` to a fresh temp file and returns its path. Caller owns cleanup.
 * Each call gets a distinct basename (services like shopper/suggester derive a
 * recipe's identity from `basename(file, ".gram")`, so same-named fixtures would
 * silently collide).
 */
export async function writeTmpFile(
	content: string,
	ext = ".gram",
): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "gram-test-"));
	const path = join(dir, `recipe-${counter++}${ext}`);
	await writeFile(path, content, "utf-8");
	return path;
}

/** Removes the parent directory created by writeTmpFile/mkdtemp for `path`. */
export async function cleanupTmpFile(path: string): Promise<void> {
	await rm(path, { force: true });
}

/** Builds a minimal IngredientData map from partial entries, defaulting `name` to the id. */
export function makeDb(
	entries: Record<string, Partial<IngredientData>>,
): Record<string, IngredientData> {
	return Object.fromEntries(
		Object.entries(entries).map(([id, data]) => [
			id,
			{ name: id, ...data } as IngredientData,
		]),
	);
}
