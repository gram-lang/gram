import { collectCorpus } from "@gram-lang/audit/corpus";
import type { CorpusEntry } from "./run";

let cached: CorpusEntry[] | null = null;

/**
 * The fuzz seeds: every Gram snippet the audit collects, invalid ones
 * included (they are the most useful starting points), one per content.
 */
export function fuzzCorpus(): CorpusEntry[] {
	if (cached) return cached;
	const seen = new Set<string>();
	cached = [];
	for (const s of collectCorpus()) {
		if (seen.has(s.content)) continue;
		seen.add(s.content);
		cached.push({ id: s.id, content: s.content });
	}
	return cached;
}
