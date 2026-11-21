import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimized inputs of fixed bugs, replayed on every invariant at each run. */
export const REGRESSIONS_DIR = join(import.meta.dir, "../regressions");

export function regressions(): { name: string; content: string }[] {
	return readdirSync(REGRESSIONS_DIR)
		.filter((f) => f.endsWith(".gram"))
		.sort()
		.map((name) => ({
			name,
			content: readFileSync(join(REGRESSIONS_DIR, name), "utf-8"),
		}));
}
