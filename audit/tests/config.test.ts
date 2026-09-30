import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { buildTrustedVocabulary } from "../src/checks/construct-vocabulary";
import {
	AI_GENERATION_NOTES_FILES,
	missingConfiguredPaths,
	TRUSTED_SYNTAX_FILES,
} from "../src/config";
import {
	extractNonTrustedDocsFences,
	extractTrustedCorpusFences,
} from "../src/extract/markdown-fences";
import { runSelfTest } from "../src/self-test";

/*
 * The audit reads the docs by path. The docs moved once (VitePress to Astro)
 * and the tool went on running on an empty trusted corpus, flagging 420 of 423
 * snippets, because the extractors skip a missing file quietly. These checks
 * fail as soon as the paths it is configured with stop matching the repo.
 */

describe("audit configuration", () => {
	it("only names paths that exist", () => {
		expect(missingConfiguredPaths()).toEqual([]);
	});

	it("finds every trusted syntax page, in both languages", () => {
		expect(TRUSTED_SYNTAX_FILES).toHaveLength(18);
		expect(AI_GENERATION_NOTES_FILES).toHaveLength(2);
		for (const file of TRUSTED_SYNTAX_FILES) {
			expect(file).toMatch(/\.mdx?$/);
		}
	});

	it("reads gram fences from the trusted pages of each language", () => {
		const snippets = extractTrustedCorpusFences();
		const inFrench = snippets.filter((s) => s.file.includes("/fr/")).length;
		// Dozens of examples each: an empty or near-empty corpus is the failure
		// this guards against (`cheatsheet` is tables only, so no per-page rule).
		expect(inFrench).toBeGreaterThan(30);
		expect(snippets.length - inFrench).toBeGreaterThan(30);
	});

	it("reads .mdx pages as well as .md ones", () => {
		const files = new Set(extractNonTrustedDocsFences().map((s) => s.file));
		expect([...files].some((f) => f.endsWith(".mdx"))).toBe(true);
		expect([...files].some((f) => f.endsWith(".md"))).toBe(true);
	});

	it("does not flag the doc's own good examples (the tool's self-test)", () => {
		const asts = extractTrustedCorpusFences().flatMap((s) => {
			try {
				return [getAST(s.content)];
			} catch {
				return [];
			}
		});
		const { findings } = runSelfTest(buildTrustedVocabulary(asts));
		// A ✅ example flagged means the trusted vocabulary is too small, which is
		// what an empty corpus looks like.
		const falsePositives = findings.filter((f) =>
			f.summary.includes("(✅ example) itself flagged"),
		);
		expect(falsePositives.map((f) => f.summary)).toEqual([]);
	});
});
