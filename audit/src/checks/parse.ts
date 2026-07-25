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
	// to exercise graceful error handling); tmpfile writes commonly feed a CLI
	// service (checker/differ) with its own error handling too — a raw
	// getAST() throw on either's input is plausible, intentional content for
	// those tests, not necessarily a mistake, so it's only worth a look, not
	// a flag.
	const isNonThrowingWrapper =
		snippet.label === "parseDocument" || snippet.sourceKind === "inline-test-tmpfile";

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
				? `input causes a parse error (may be intentional, testing graceful handling elsewhere): ${errorMessage}`
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
