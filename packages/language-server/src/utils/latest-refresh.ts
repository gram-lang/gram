/**
 * Which refresh of each document is the latest one started. A refresh awaits
 * the module graph before it compiles, so two of them can overlap: an edit, a
 * new session or a config change starts another while the first is still
 * loading. Only the latest may write its result; an older one that finishes
 * after it would put back a stale state, stale diagnostics and stale views,
 * until the next edit.
 *
 * Tokens come from one counter for every document, so a document closed then
 * opened again never takes a refresh started before it closed for its own.
 */
export class LatestRefresh {
	private readonly current = new Map<string, number>();
	private last = 0;

	/** Starts a refresh of `uri`: every one started before is now outdated. */
	begin(uri: string): number {
		this.last += 1;
		this.current.set(uri, this.last);
		return this.last;
	}

	/** Whether the refresh `token` of `uri` is still the latest one started. */
	isLatest(uri: string, token: number): boolean {
		return this.current.get(uri) === token;
	}

	/** The document closed: none of its refreshes in flight may write. */
	forget(uri: string): void {
		this.current.delete(uri);
	}
}
