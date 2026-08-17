import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/**
 * Reads just the `paths:` alias map out of `<projectRoot>/.gram/config.yaml`
 * (module-imports RFC §B.1/§F.1) — the same field the CLI's `GramConfig`
 * schema validates in full (`packages/cli/src/types.ts:274`), but the
 * language server has no other use for the rest of that config today, so
 * this reads only the one field it needs instead of depending on the CLI's
 * config loader (and its zod schema, AI settings, etc.) from a package that
 * has no business knowing about them. Never throws — a missing, unreadable,
 * or malformed config file just means no aliases are known, the same
 * degrade-gracefully rule every other module-resolution failure here
 * follows.
 */
export function readPathsConfigSync(
	projectRoot: string,
): Record<string, string> | undefined {
	const configPath = join(projectRoot, ".gram", "config.yaml");
	if (!existsSync(configPath)) return undefined;
	try {
		const content = readFileSync(configPath, "utf-8");
		const parsed = parse(content) as { paths?: unknown } | undefined;
		const paths = parsed?.paths;
		if (!paths || typeof paths !== "object") return undefined;
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(paths)) {
			if (typeof value === "string") result[key] = value;
		}
		return result;
	} catch {
		return undefined;
	}
}
