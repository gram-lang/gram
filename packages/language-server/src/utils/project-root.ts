import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Synchronous counterpart to the CLI's `findProjectRoot`
 * (`packages/cli/src/core/workspace.ts:18`): walks up from `start` looking
 * for a `.gram` directory, falling back to `start` itself when none is
 * found. Kept sync (unlike the CLI's version) because it feeds the
 * language server's module resolution, which itself must stay synchronous
 * on the `getFreshState` path (module-imports RFC §F.1) — an async project
 * root lookup would force every caller of that path to become async too.
 */
export function findProjectRootSync(start: string): string {
	let dir = resolve(start);
	while (true) {
		if (existsSync(resolve(dir, ".gram"))) return dir;
		const parent = dirname(dir);
		if (parent === dir) return resolve(start);
		dir = parent;
	}
}
