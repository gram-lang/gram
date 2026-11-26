/**
 * Levenshtein edit distance. Internal to the analyzer (not re-exported from
 * `index.ts`): it backs `findClosestIngredients`, and is used only for
 * spelling suggestions on unknown ingredients, never for hot-path lookups.
 */
export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let prev = i;
		for (let j = 1; j <= b.length; j++) {
			const curr =
				a[i - 1] === b[j - 1]
					? row[j - 1]!
					: 1 + Math.min(row[j - 1]!, row[j]!, prev);
			row[j - 1] = prev;
			prev = curr;
		}
		row[b.length] = prev;
	}
	return row[b.length]!;
}
