import { extractConformanceCases, extractPhysicalFixtures } from "./extract/fixtures";
import { extractInlineTestLiterals } from "./extract/inline-tests";
import { extractNonTrustedDocsFences, extractTrustedCorpusFences } from "./extract/markdown-fences";
import { extractSelfTestSnippets } from "./extract/self-test-cases";
import { extractTmpfileWrites } from "./extract/tmpfile-writes";
import type { SkippedExtraction, Snippet } from "./types";

/** Every piece of Gram source in the repo, grouped by the role the audit gives it. */
export interface CorpusParts {
	/** reference/syntax pages (EN+FR) ✅ fences: the known-good vocabulary. */
	trusted: Snippet[];
	/** What the audit triages: docs fences, fixtures, conformance cases, test literals. */
	targets: Snippet[];
	/** ai-generation-notes ❌/✅ pairs, checked against the audit's own coverage. */
	selfTest: { bad: Snippet[]; good: Snippet[]; staleness: string | null };
	/** Inline test literals the extractor could not read statically. */
	skipped: SkippedExtraction[];
}

/**
 * The single collector of Gram sources in the repo, shared by the content
 * audit (`audit.ts`) and the fuzzer (`fuzz/`): no list of paths lives twice.
 */
export function collectCorpusParts(): CorpusParts {
	const { snippets: inlineLiterals, skipped } = extractInlineTestLiterals();
	return {
		trusted: extractTrustedCorpusFences(),
		targets: [
			...extractNonTrustedDocsFences(),
			...extractPhysicalFixtures(),
			...extractConformanceCases(),
			...inlineLiterals,
			...extractTmpfileWrites(),
		],
		selfTest: extractSelfTestSnippets(),
		skipped,
	};
}

/** Every snippet, whatever its role, invalid ones included. */
export function collectCorpus(): Snippet[] {
	const { trusted, targets, selfTest } = collectCorpusParts();
	return [...trusted, ...targets, ...selfTest.bad, ...selfTest.good];
}
