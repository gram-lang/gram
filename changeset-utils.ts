// Shared helpers for turning raw changeset summaries into clean, professional
// changelog prose. Used by both generate-release-note.ts (which writes the
// release note) and check-changesets.ts (which only reports, read-only).

// Conventional-commit prefixes (feat!:, fix:, chore:, etc.) are meant for git
// history, not for changelog prose read by users — strip them if they leak in.
const COMMIT_PREFIX_RE = /^(feat|fix|chore|refactor|docs|style|test|perf|build|ci)(\([^)]*\))?!?:\s*/i;

export function stripCommitPrefix(text: string): string {
	return text.replace(COMMIT_PREFIX_RE, "").trim();
}

function normalizeWords(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.replace(/[`*_#>[\]()]/g, "")
			.split(/\W+/)
			.filter((word) => word.length > 3),
	);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 || b.size === 0) return 0;
	let intersection = 0;
	for (const word of a) if (b.has(word)) intersection++;
	const union = a.size + b.size - intersection;
	return intersection / union;
}

export interface DuplicateWarning {
	title: string;
	matchedAgainst: string;
	similarity: number;
}

// Word-overlap threshold above which two titles are flagged as a likely
// duplicate. Deliberately loose (0.5) — false positives just mean a skipped
// warning line, false negatives mean a duplicate silently ships.
const SIMILARITY_THRESHOLD = 0.5;

// Compares a batch of new changeset titles against each other and against a
// pool of existing changelog lines (recent releases), flagging likely repeats
// so they can be merged before they're baked into CHANGELOG.md.
export function findLikelyDuplicates(
	newTitles: string[],
	existingLines: string[],
): DuplicateWarning[] {
	const warnings: DuplicateWarning[] = [];
	const existingSets = existingLines.map((line) => ({ line, words: normalizeWords(line) }));
	const newSets = newTitles.map((title) => normalizeWords(title));

	for (let i = 0; i < newTitles.length; i++) {
		for (let j = i + 1; j < newTitles.length; j++) {
			const similarity = jaccardSimilarity(newSets[i], newSets[j]);
			if (similarity >= SIMILARITY_THRESHOLD) {
				warnings.push({ title: newTitles[i], matchedAgainst: newTitles[j], similarity });
			}
		}

		for (const { line, words } of existingSets) {
			const similarity = jaccardSimilarity(newSets[i], words);
			if (similarity >= SIMILARITY_THRESHOLD) {
				warnings.push({ title: newTitles[i], matchedAgainst: line, similarity });
			}
		}
	}

	return warnings;
}

export interface PreReleaseState {
	changesets: string[];
}

// In changesets' prerelease mode (.changeset/pre.json present), consumed
// changeset files are deliberately kept on disk instead of deleted — they
// might be needed for the next prerelease bump. pre.json's `changesets` list
// tracks which ones have already been folded into a previous prerelease, so
// both scripts need this same filter or they'll treat shipped changesets as
// still pending.
export function filterUnreleasedChangesets<T extends { id: string }>(
	changesets: T[],
	preState: PreReleaseState | undefined,
): T[] {
	if (!preState) return changesets;
	const released = new Set(preState.changesets);
	return changesets.filter((cs) => !released.has(cs.id));
}

export interface ParsedChangesetEntry {
	// The full markdown block (title + any indented sub-bullets) for this
	// changeset's top-level bucket (Major/New Features/Fixes).
	formattedEntry: string;
	// Just the cleaned title line — used for display and duplicate detection.
	head: string;
	// Bullets collected under a bold **Breaking**/**Fixed**/etc. sub-heading
	// inside the changeset body, kept separate from the top-level bucket.
	sections: Record<string, string[]>;
}

// Parses a single changeset's raw markdown summary into a changelog-ready
// entry. Shared by generate-release-note.ts (writes it) and
// check-changesets.ts (previews it) so the two can never drift apart.
export function parseChangesetSummary(summary: string): ParsedChangesetEntry {
	const lines = summary.trim().split("\n");
	let currentSection = "";
	const titleParts: string[] = [];
	const sections: Record<string, string[]> = {};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const headingMatch = trimmed.match(/^\*\*([^*]+)\*\*[:]*\s*$/);
		if (headingMatch) {
			let sectionName = headingMatch[1].trim().replace(/:$/, "").trim();
			if (sectionName.match(/breaking/i)) sectionName = "Breaking";
			else if (sectionName.match(/fixed/i) || sectionName.match(/^fix$/i)) sectionName = "Fixed";

			currentSection = sectionName;
			if (!sections[currentSection]) sections[currentSection] = [];
		} else if (currentSection) {
			let item = trimmed;
			if (!item.startsWith("- ")) {
				item = item.replace(/^[-*]\s*/, "");
				item = `- ${item}`;
			}
			sections[currentSection].push(item);
		} else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
			titleParts.push(`  ${trimmed.replace(/^\*\s*/, "- ")}`);
		} else {
			if (titleParts.length === 0 || titleParts[0].startsWith("  ")) {
				titleParts.unshift(trimmed);
			} else {
				titleParts[0] += ` ${trimmed}`;
			}
		}
	}

	let formattedEntry = "";
	let head = "";
	if (titleParts.length > 0) {
		const first = titleParts[0];
		const rawHead = first.startsWith("  ") ? first.trimStart() : first.startsWith("-") ? first : `- ${first}`;
		head = `- ${stripCommitPrefix(rawHead.replace(/^-\s*/, ""))}`;
		const rest = titleParts.slice(1);
		formattedEntry = [head, ...rest].join("\n");
	}

	return { formattedEntry, head, sections };
}

// Pulls bullet lines ("- ...") out of the most recent releases in the
// existing CHANGELOG.md, to use as the duplicate-detection pool. Limited to
// recent history: older entries are unlikely to be accidentally re-described,
// and keeping the pool small keeps the comparison cheap and its warnings
// relevant.
export function extractRecentChangelogLines(changelogContent: string, releaseCount = 3): string[] {
	const versionHeadingRe = /^## \[/;
	const lines = changelogContent.split("\n");
	const recentLines: string[] = [];
	let versionsSeen = 0;

	for (const line of lines) {
		if (versionHeadingRe.test(line)) {
			versionsSeen++;
			if (versionsSeen > releaseCount) break;
		}
		if (line.trim().startsWith("- ")) recentLines.push(line.trim());
	}

	return recentLines;
}
