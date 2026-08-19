import {
	parseDocument,
	type DocumentState,
	type ModuleContext,
} from "../document-state";
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
 *
 * `moduleCtx`, when given, carries the document's *already-loaded* `@use`
 * graph (`server.ts`'s `graphs` map) — this function never reloads it (that
 * stays `refresh()`'s job, see `server.ts`'s note on the async/sync split),
 * it just re-composes against the graph already on hand so a stale re-parse
 * doesn't silently drop module composition for rename/formatting/code-action
 * requests that land between two debounced refreshes.
 */
export function resolveFreshState(
	cached: DocumentState | undefined,
	liveText: string,
	liveVersion: number | undefined,
	db: Record<string, IngredientData>,
	moduleCtx?: ModuleContext,
): DocumentState {
	if (cached) {
		const isFresh =
			liveVersion !== undefined
				? cached.version === liveVersion
				: cached.text === liveText;
		if (isFresh) return cached;
	}
	return parseDocument(liveText, db, liveVersion, moduleCtx);
}
