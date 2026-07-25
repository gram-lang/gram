import { getAST } from "@gram-lang/parser";
import { extractSelfTestSnippets } from "./extract/self-test-cases";
import { checkConstructVocabulary, type TrustedVocabulary } from "./checks/construct-vocabulary";
import { checkFormatDiff } from "./checks/format-diff";
import { checkWarnings } from "./checks/warnings";
import type { Finding } from "./types";

// Runs checks 1-4 against every ai-generation-notes.md ❌/✅ pair. This
// validates the AUDIT TOOL's own coverage, not new content: a ❌ example that
// trips zero checks is a gap in the tool (it can't catch a known mistake); a
// ✅ example that trips any check is a false positive on doc-sanctioned Gram.
export function runSelfTest(trusted: TrustedVocabulary): {
	findings: Finding[];
	staleness: string | null;
} {
	const { bad, good, staleness } = extractSelfTestSnippets();
	const findings: Finding[] = [];

	for (const snippet of bad) {
		const signals: Finding[] = [];
		let ast: ReturnType<typeof getAST> | null = null;

		try {
			ast = getAST(snippet.content);
		} catch (e) {
			signals.push({
				snippetId: snippet.id,
				check: "parse",
				severity: "flag",
				summary: `parse error: ${e instanceof Error ? e.message : String(e)}`,
			});
		}

		if (ast) {
			signals.push(...checkWarnings(snippet, ast));
			signals.push(...checkFormatDiff(snippet));
			signals.push(...checkConstructVocabulary(snippet, ast, trusted));
		}

		if (signals.length === 0) {
			findings.push({
				snippetId: snippet.id,
				check: "self-test",
				severity: "flag",
				summary: `self-test gap: "${snippet.label}" (❌ example) not flagged by any check`,
			});
		}
	}

	for (const snippet of good) {
		const signals: Finding[] = [];
		let ast: ReturnType<typeof getAST> | null = null;

		try {
			ast = getAST(snippet.content);
		} catch (e) {
			signals.push({
				snippetId: snippet.id,
				check: "parse",
				severity: "flag",
				summary: `parse error: ${e instanceof Error ? e.message : String(e)}`,
			});
		}

		if (ast) {
			signals.push(...checkWarnings(snippet, ast));
			signals.push(...checkFormatDiff(snippet));
			signals.push(...checkConstructVocabulary(snippet, ast, trusted));
		}

		if (signals.length > 0) {
			findings.push({
				snippetId: snippet.id,
				check: "self-test",
				severity: "flag",
				summary: `self-test anomaly: "${snippet.label}" (✅ example) itself flagged — ${signals
					.map((s) => s.summary)
					.join(" | ")}`,
			});
		}
	}

	return { findings, staleness };
}
