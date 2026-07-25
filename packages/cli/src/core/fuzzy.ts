import type { IngredientData } from "@gram-lang/analyzer";
import type { FuzzyMatch } from "../types";

function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	const la = a.length,
		lb = b.length;
	if (la === 0) return lb;
	if (lb === 0) return la;

	let prev = Array.from({ length: lb + 1 }, (_, i) => i);
	for (let i = 1; i <= la; i++) {
		const curr = [i];
		for (let j = 1; j <= lb; j++) {
			curr[j] =
				a[i - 1] === b[j - 1]
					? prev[j - 1]!
					: 1 + Math.min(prev[j - 1]!, prev[j]!, curr[j - 1]!);
		}
		prev = curr;
	}
	return prev[lb]!;
}

export function similarity(a: string, b: string): number {
	if (a === b) return 1;
	const maxLen = Math.max(a.length, b.length);
	if (maxLen === 0) return 1;
	return 1 - levenshtein(a, b) / maxLen;
}

export function findSimilarInDb(
	newId: string,
	db: Record<string, IngredientData>,
	threshold = 0.8,
): FuzzyMatch | null {
	let best: FuzzyMatch | null = null;
	for (const existingId of Object.keys(db)) {
		// Cheap pre-filter before paying for a full Levenshtein matrix: edit distance
		// is always >= the length difference between the two strings, so if that
		// difference alone already exceeds what the threshold could tolerate, this
		// candidate can never score >= threshold — skip it. Never produces a false
		// negative (it's a mathematical lower bound on levenshtein), only saves work.
		const maxLen = Math.max(newId.length, existingId.length);
		if (
			maxLen > 0 &&
			Math.abs(newId.length - existingId.length) / maxLen > 1 - threshold
		)
			continue;

		const score = similarity(newId, existingId);
		if (score >= threshold && score < 1 && score > (best?.score ?? 0)) {
			best = { newId, existingId, score };
		}
	}
	return best;
}
