import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The ratchet: violations already found and not fixed yet, each tied to an
 * issue. The fuzz test fails on a violation missing from this list, and on
 * an entry whose `example` no longer fails: the file can only shrink.
 */
export interface KnownFailure {
	signature: string;
	invariant: string;
	/** Forgejo issue tracking the fix. */
	issue: string;
	/** A minimized input that triggers it. */
	example: string;
}

export const KNOWN_FAILURES_PATH = join(
	import.meta.dir,
	"../known-failures.json",
);

export function knownFailures(): KnownFailure[] {
	return JSON.parse(
		readFileSync(KNOWN_FAILURES_PATH, "utf-8"),
	) as KnownFailure[];
}
