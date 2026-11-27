import type { LintDiagnostic, LintFix, TextPatch } from "./types";

/** A preferred fix `applyPreferredFixes` applied, with the diagnostic it fixes. */
export interface AppliedFix {
	diagnostic: LintDiagnostic;
	fix: LintFix;
}

/**
 * Whether two patches touch the same text. Two insertions at one point
 * overlap (their order would be a guess), and so does an insertion at
 * either edge of a replacement; two replacements that only meet do not.
 */
function overlaps(a: TextPatch, b: TextPatch): boolean {
	if (a.start === a.end || b.start === b.end)
		return a.start <= b.end && b.start <= a.end;
	return a.start < b.end && b.start < a.end;
}

/**
 * The patches of `fix` when it may be applied to `text` alone: only
 * patches of the recipe `uri` (no `createFile`, no other file), at least
 * one, each within the text, none overlapping another of the same fix.
 */
function patchesOf(
	fix: LintFix,
	uri: string,
	length: number,
): TextPatch[] | null {
	const patches: TextPatch[] = [];
	for (const edit of fix.edits) {
		if (edit.kind !== "patch" || edit.uri !== uri) return null;
		patches.push(...edit.patches);
	}
	if (patches.length === 0) return null;
	for (const p of patches)
		if (p.start < 0 || p.end < p.start || p.end > length) return null;
	for (let i = 0; i < patches.length; i++)
		for (let j = i + 1; j < patches.length; j++)
			if (overlaps(patches[i]!, patches[j]!)) return null;
	return patches;
}

const firstStart = (patches: TextPatch[]) =>
	Math.min(...patches.map((p) => p.start));

/**
 * Applies to `text` (the document `uri`) the preferred fix of each of its
 * diagnostics, as `gram check --fix` does in one pass. A fix is left out
 * whole when it creates a file, edits another file, has no patch or one
 * outside the text, or overlaps a fix already kept; the fixes are kept in
 * text order (the first patch of each), so the outcome never depends on the
 * order of the diagnostics. Patches are applied from the end of the text
 * back, so no offset moves under another.
 *
 * Pure: the caller lints the result again to see what is left.
 *
 * @experimental
 */
export function applyPreferredFixes(
	text: string,
	uri: string,
	diagnostics: readonly LintDiagnostic[],
): { text: string; applied: AppliedFix[] } {
	const candidates: { applied: AppliedFix; patches: TextPatch[] }[] = [];
	for (const diagnostic of diagnostics) {
		if (diagnostic.uri !== uri) continue;
		const fix = diagnostic.fixes?.find((f) => f.isPreferred);
		if (!fix) continue;
		const patches = patchesOf(fix, uri, text.length);
		if (patches) candidates.push({ applied: { diagnostic, fix }, patches });
	}
	// A stable sort: two fixes starting at one point keep the diagnostics' order.
	candidates.sort((a, b) => firstStart(a.patches) - firstStart(b.patches));

	const kept: TextPatch[] = [];
	const applied: AppliedFix[] = [];
	for (const c of candidates) {
		if (c.patches.some((p) => kept.some((k) => overlaps(p, k)))) continue;
		kept.push(...c.patches);
		applied.push(c.applied);
	}

	let out = text;
	for (const p of [...kept].sort((a, b) => b.start - a.start))
		out = out.slice(0, p.start) + p.replacement + out.slice(p.end);
	return { text: out, applied };
}
