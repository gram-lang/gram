import { analyze } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import type { RecipeAST } from "@gram-lang/parser";
import type { Finding, Snippet } from "../types";

// Reuses the exact in-memory reference pipeline conformance/run.ts is built
// on (getAST -> compile -> analyze), not the CLI's checker.ts service — that
// wraps the same pipeline with file-I/O and line-number resolution that adds
// nothing here, since every snippet is already in memory.
export function checkWarnings(snippet: Snippet, ast: RecipeAST): Finding[] {
	const findings: Finding[] = [];

	try {
		const compiled = compile(ast);
		analyze(compiled, {}); // empty ingredient DB — same default conformance/run.ts uses

		const expected = new Set(snippet.expectedWarningCodes ?? []);
		for (const w of compiled.warnings) {
			if (!expected.has(w.code)) {
				findings.push({
					snippetId: snippet.id,
					check: "warnings",
					severity: "flag",
					summary: `unexpected warning ${w.code}: ${w.message}`,
				});
			}
		}
	} catch (e) {
		// A snippet that parses but fails to compile/analyze is itself
		// noteworthy — surface it rather than silently swallowing it.
		findings.push({
			snippetId: snippet.id,
			check: "warnings",
			severity: "info",
			summary: `compile/analyze threw after a successful parse: ${
				e instanceof Error ? e.message : String(e)
			}`,
		});
	}

	return findings;
}
