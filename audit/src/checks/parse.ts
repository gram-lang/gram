import { getAST } from "@gram-lang/parser";
import type { RecipeAST } from "@gram-lang/parser";
import type { Finding, Snippet } from "../types";

export interface ParseOutcome {
	snippet: Snippet;
	ast: RecipeAST | null;
	findings: Finding[];
}

export function checkParse(snippet: Snippet): ParseOutcome {
	const findings: Finding[] = [];
	let ast: RecipeAST | null = null;
	let threw = false;
	let errorMessage = "";

	try {
		ast = getAST(snippet.content);
	} catch (e) {
		threw = true;
		errorMessage = e instanceof Error ? e.message : String(e);
	}

	// parseDocument's whole contract is to catch a parse error internally and
	// return a null AST rather than throw (used by language-server/CLI tests
	// to exercise graceful error handling) — a raw getAST() throw on its
	// input is expected content for those tests, not a mistake, so it's only
	// worth a look, not a flag.
	const isNonThrowingWrapper = snippet.label === "parseDocument";

	if (snippet.expectation === "must-throw" && !threw) {
		findings.push({
			snippetId: snippet.id,
			check: "parse",
			severity: "flag",
			summary: "expected a thrown parse error, parsed cleanly instead",
		});
	} else if (snippet.expectation === "must-parse" && threw) {
		findings.push({
			snippetId: snippet.id,
			check: "parse",
			severity: isNonThrowingWrapper ? "info" : "flag",
			summary: isNonThrowingWrapper
				? `parseDocument input causes a parse error (may be intentional, testing graceful handling): ${errorMessage}`
				: `unexpected parse error: ${errorMessage}`,
		});
	} else if (snippet.expectation === "unclear" && threw) {
		findings.push({
			snippetId: snippet.id,
			check: "parse",
			severity: "info",
			summary: `needs classification — parse error, verify test intent: ${errorMessage}`,
		});
	}

	return { snippet, ast, findings };
}
