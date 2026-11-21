#!/usr/bin/env bun
/**
 * Gram content audit. Triages every piece of Gram source embedded in the
 * repo (test fixtures, inline getAST()/parseDocument()/formatGram() calls,
 * docs examples, conformance cases) against a trusted vocabulary built from
 * the human-verified reference/syntax pages (EN+FR) of the docs,
 * so manual review only has to cover what's flagged below.
 *
 * Usage:
 *   bun run audit.ts             # print a triage report
 *   bun run audit.ts --json      # write report.json instead
 *   bun run audit.ts kitchen     # only audit targets whose file/label contains "kitchen"
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAST } from "@gram-lang/parser";
import { calibrateFormatter, checkFormatDiff } from "./src/checks/format-diff";
import { checkParse } from "./src/checks/parse";
import { buildTrustedVocabulary, checkConstructVocabulary } from "./src/checks/construct-vocabulary";
import { checkWarnings } from "./src/checks/warnings";
import { missingConfiguredPaths, REPO_ROOT } from "./src/config";
import { collectCorpusParts } from "./src/corpus";
import { printReport } from "./src/report";
import { runSelfTest } from "./src/self-test";
import type { Finding, Snippet } from "./src/types";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const filters = args.filter((a) => a !== "--json");

function matchesFilter(snippet: Snippet): boolean {
	if (filters.length === 0) return true;
	return filters.some(
		(f) => snippet.file.includes(f) || (snippet.label?.includes(f) ?? false),
	);
}

// 0. The paths this tool is configured with must exist. Without the check, a
// moved docs folder leaves it running on an empty trusted corpus.
const missing = missingConfiguredPaths();
if (missing.length > 0) {
	console.error(
		`audit: ${missing.length} configured path(s) not found (audit/src/config.ts is out of date):\n${missing.map((p) => `  - ${p}`).join("\n")}`,
	);
	process.exit(1);
}

// 1. Extraction
const corpus = collectCorpusParts();
const trustedFences = corpus.trusted;
const skipped = corpus.skipped;
const auditTargets: Snippet[] = corpus.targets.filter(matchesFilter);

// 2. Calibration — must run before any format-diff finding below is trusted.
const calibration = calibrateFormatter(trustedFences);

// 3. Trusted vocabulary, built once from whichever trusted fences parse.
const trustedAsts = trustedFences
	.map((s) => {
		try {
			return getAST(s.content);
		} catch {
			return null;
		}
	})
	.filter((a): a is NonNullable<typeof a> => a !== null);
const trustedVocabulary = buildTrustedVocabulary(trustedAsts);

// 4. Run checks over every audit target.
const findings: Finding[] = [];
const needsClassification: Snippet[] = [];
const snippetsById = new Map<string, Snippet>();

for (const snippet of auditTargets) {
	snippetsById.set(snippet.id, snippet);
	if (snippet.expectation === "unclear") needsClassification.push(snippet);

	const { ast, findings: parseFindings } = checkParse(snippet);
	findings.push(...parseFindings);
	if (!ast) continue;

	findings.push(...checkWarnings(snippet, ast));
	findings.push(...checkFormatDiff(snippet));
	findings.push(...checkConstructVocabulary(snippet, ast, trustedVocabulary));
}

// 5. Self-test — validates the tool's own coverage against known mistakes.
const selfTest = runSelfTest(trustedVocabulary, corpus.selfTest);

const report = {
	calibration,
	selfTest,
	needsClassification,
	findings,
	skipped,
	totalSnippets: auditTargets.length,
	snippetsById,
};

if (asJson) {
	const serializable = {
		...report,
		snippetsById: Object.fromEntries(snippetsById),
	};
	writeFileSync(join(REPO_ROOT, "audit", "report.json"), JSON.stringify(serializable, null, 2));
	console.log("Wrote audit/report.json");
} else {
	printReport(report);
}
