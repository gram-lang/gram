import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type LintConfig, parseLintConfig } from "@gram-lang/modules/lint";
import { parse } from "yaml";

/**
 * The `lint:` settings of a project, read from its own `.gram/config.yaml`
 * only, as the language server reads them (`project-config.ts`): the global
 * `~/.config/gram/config.yaml` does not silence a rule, so the editor and
 * `gram check` always show the same diagnostics. A missing or unreadable
 * file, or one that is not YAML, means no settings.
 */
export async function readLintConfig(projectRoot: string): Promise<LintConfig> {
	try {
		const raw: unknown = parse(
			await readFile(join(projectRoot, ".gram", "config.yaml"), "utf-8"),
		);
		return parseLintConfig(raw);
	} catch {
		return { rules: {} };
	}
}
