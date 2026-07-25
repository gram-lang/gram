import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function walkFiles(root: string, predicate: (name: string) => boolean): string[] {
	if (!existsSync(root)) return [];
	const results: string[] = [];
	const stack = [root];
	while (stack.length > 0) {
		const dir = stack.pop()!;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === "node_modules" || entry.name === "dist") continue;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				stack.push(full);
			} else if (predicate(entry.name)) {
				results.push(full);
			}
		}
	}
	return results;
}
