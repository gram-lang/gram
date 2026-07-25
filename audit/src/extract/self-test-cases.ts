import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AI_GENERATION_NOTES_FILES, REPO_ROOT } from "../config";
import type { Snippet } from "../types";

interface SelfTestCase {
	label: string;
	bad: string;
	good: string;
}

// Hand-transcribed from packages/docs/src/reference/syntax/ai-generation-notes.md's
// ❌/✅ pairs (EN). The doc's own formatting (some fences hold two unrelated
// pairs, some interleave prose comments) is too irregular for a generic
// parser to be worth building for ~12 rarely-changing categories — see
// EXPECTED_BAD_GLYPH_COUNT below for the staleness guard that catches drift
// instead of trying to auto-parse the doc.
export const SELF_TEST_CASES: SelfTestCase[] = [
	{
		label: "kebab-case-ingredient-name",
		bad: "## Prep\n\nAdd @olive-oil{2 tbsp} to the pan.\n",
		good: "## Prep\n\nAdd @olive oil{2 tbsp} to the pan.\n",
	},
	{
		label: "multi-word-name-without-braces",
		bad: "## Prep\n\nAdd @egg substitute and mix well.\n",
		good: "## Prep\n\nAdd @egg substitute{} and mix well.\n",
	},
	{
		label: "units-inside-cookware-braces",
		bad: "## Prep\n\nHeat the #pan{20cm} on high.\n",
		good: "## Prep\n\nHeat the #pan(20cm) on high.\n",
	},
	{
		label: "free-text-where-number-required",
		bad: "## Prep\n\nSeason with @salt{to taste}.\n",
		good: "## Prep\n\nSeason with @salt{}.\n",
	},
	{
		label: "ampersand-on-first-occurrence",
		bad: "## Prep\n\nMelt the @&butter{200g} in a pan.\n",
		good: "## Prep\n\nMelt the @butter{200g} in a pan.\n",
	},
	{
		label: "bare-reference-to-raw-ingredient",
		bad: "## Prep\n\nAdd @chicken{4}.\n\nBrown the &chicken for ~{3min}.\n",
		good: "## Prep\n\nAdd @chicken{4}.\n\nBrown the @&chicken for ~{3min}.\n",
	},
	{
		label: "ampersand-reference-to-intermediate",
		bad: "## Dough ->&dough\n\nMix @flour{200g} with @water{100g}.\n\n## Assembly\n\nRoll out the @&dough.\n",
		good: "## Dough ->&dough\n\nMix @flour{200g} with @water{100g}.\n\n## Assembly\n\nRoll out the &dough.\n",
	},
	{
		label: "standalone-prep-only-step",
		bad: "## Prep\n\nCut @lemon{1} in half. Thinly slice one half for garnish.\n\n## Cook\n\nSqueeze juice from @lemon{1/2} into the pan.\n",
		good: "## Cook\n\nSqueeze @juice<@lemon{1}(cut in half, one half sliced for garnish) into the pan.\n",
	},
	{
		label: "prose-instead-of-composite-syntax",
		bad: "## Prep\n\nAdd the juice from @lemon{1/2}.\n",
		good: "## Prep\n\nAdd @juice<@lemon{1/2}.\n",
	},
	{
		label: "spaces-around-composite-operator",
		bad: "## Prep\n\nAdd @zest{1} < @lemon{2}.\n",
		good: "## Prep\n\nAdd @zest{1}<@lemon{2}.\n",
	},
	{
		label: "composite-preparation-wrong-side",
		bad: "## Prep\n\nAdd @juice(cut in half, one half sliced for garnish)<@lemon{1}.\n",
		good: "## Prep\n\nAdd @juice<@lemon{1}(cut in half, one half sliced for garnish).\n",
	},
	{
		label: "redundant-section-level-declaration",
		bad: "## Seasoning Mix ->&seasoning\n\nMix @paprika{2 tsp} with @salt{1 tsp}. ->&mix1\n",
		good: "## Seasoning Mix ->&seasoning\n\nMix @paprika{2 tsp} with @salt{1 tsp}.\n",
	},
	{
		label: "active-timer-for-passive-cooking",
		bad: "## Bake\n\nBake for ~{45min}.\n",
		good: "## Bake\n\nBake for ~_{45min}.\n",
	},
];

// Raw ❌ glyph count observed in the EN doc as of this transcription. If the
// live count drifts, the doc likely gained (or lost) a mistake example that
// nobody transcribed here yet — print an informational note, don't fail.
const EXPECTED_BAD_GLYPH_COUNT = 20;

export function extractSelfTestSnippets(): {
	bad: Snippet[];
	good: Snippet[];
	staleness: string | null;
} {
	const bad: Snippet[] = [];
	const good: Snippet[] = [];

	for (const c of SELF_TEST_CASES) {
		bad.push({
			id: `self-test:${c.label}:bad`,
			sourceKind: "self-test-bad",
			file: "packages/docs/src/reference/syntax/ai-generation-notes.md",
			label: c.label,
			content: c.bad,
			expectation: "unclear", // some ❌ examples are hard parse errors, some are semantic
		});
		good.push({
			id: `self-test:${c.label}:good`,
			sourceKind: "self-test-good",
			file: "packages/docs/src/reference/syntax/ai-generation-notes.md",
			label: c.label,
			content: c.good,
			expectation: "must-parse",
		});
	}

	let staleness: string | null = null;
	const enFile = AI_GENERATION_NOTES_FILES[0];
	if (enFile) {
		const absPath = join(REPO_ROOT, enFile);
		if (existsSync(absPath)) {
			const text = readFileSync(absPath, "utf-8");
			const liveCount = (text.match(/❌/g) ?? []).length;
			if (liveCount !== EXPECTED_BAD_GLYPH_COUNT) {
				staleness =
					`ai-generation-notes.md now has ${liveCount} "❌" glyphs, expected ${EXPECTED_BAD_GLYPH_COUNT} ` +
					`— the doc may have gained/lost a mistake example; check whether self-test-cases.ts needs updating.`;
			}
		}
	}

	return { bad, good, staleness };
}
