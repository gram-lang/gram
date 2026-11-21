import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IngredientData } from "@gram-lang/analyzer";

/**
 * The playground's example database: the one the docs run `analyze()` with on
 * every keystroke, so the one a real document meets.
 */
const PATH = join(
	import.meta.dir,
	"../../packages/docs/src/components/playground/ingredients.yaml",
);

let cached: Record<string, IngredientData> | null = null;

export function exampleDatabase(): Record<string, IngredientData> {
	cached ??= Bun.YAML.parse(readFileSync(PATH, "utf-8")) as Record<
		string,
		IngredientData
	>;
	return cached;
}
