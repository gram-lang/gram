import { parseDocument, type DocumentState } from "../document-state";
import type { IngredientData } from "@gram-lang/analyzer";

/**
 * Returns a DocumentState guaranteed to match the live document text/version,
 * re-parsing synchronously when the cached state is behind.
 *
 * `refresh()` is debounced (150ms), so the cached state in `server.ts`'s
 * `states` map can briefly lag behind the live
 * document. That's harmless for read-only features (hover, semantic tokens,
 * ...) but not for ones that compute a TextEdit against text/offsets —
 * formatting, rename, and code actions must call this instead of reading the
 * cache directly, so an edit is never computed against stale content.
 *
 * Kept separate from `server.ts`'s module-level `states`/`documents` maps so
 * the actual staleness-detection logic is testable without spinning up an
 * LSP connection.
 */
export function resolveFreshState(
	cached: DocumentState | undefined,
	liveText: string,
	liveVersion: number | undefined,
	db: Record<string, IngredientData>,
): DocumentState {
	if (cached) {
		const isFresh =
			liveVersion !== undefined
				? cached.version === liveVersion
				: cached.text === liveText;
		if (isFresh) return cached;
	}
	return parseDocument(liveText, db, liveVersion);
}
