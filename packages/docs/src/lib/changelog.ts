import rawChangelog from "../../../../CHANGELOG.md?raw";

export interface ChangelogEntry {
	version: string;
	date: string;
	compareUrl?: string;
	anchor: string;
	bodyMarkdown: string;
}

const RELEASE_HEADING =
	/^## (?:\[([^\]]+)\](?:\(([^)]*)\))?|(\d+\.\d+\.\d+(?:-[^\s]+)?)) - (\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/;

/**
 * Normalizes `YYYY-MM-DD` or legacy `M/D/YYYY` dates into ISO `YYYY-MM-DD`.
 */
function normalizeDate(rawDate: string): string {
	const slashMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!slashMatch) return rawDate;
	const [, month, day, year] = slashMatch;
	return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
}

/**
 * Computes the URL anchor slug for a changelog release heading, matching
 * Starlight's heading slug convention (`"140---2026-11-13"`).
 */
export function formatReleaseAnchor(version: string, rawDate: string): string {
	return `${version.replace(/\./g, "")}---${rawDate.replace(/\//g, "")}`;
}

/**
 * Splits a Keep-a-Changelog style markdown document into structured per-release
 * sections while stripping horizontal rule separators between entries.
 */
export function parseChangelog(markdown: string): ChangelogEntry[] {
	const lines = markdown.split(/\r?\n/);
	const entries: ChangelogEntry[] = [];
	let current: ChangelogEntry | undefined;
	let bodyLines: string[] = [];

	const flush = () => {
		if (!current) return;
		const trimmed = bodyLines
			.join("\n")
			.replace(/^\s+/, "")
			.replace(/\n---\s*$/, "")
			.trim();
		current.bodyMarkdown = trimmed;
		entries.push(current);
	};

	for (const line of lines) {
		const match = line.match(RELEASE_HEADING);
		if (match) {
			flush();
			const version = match[1] ?? match[3] ?? "";
			const compareUrl = match[2] || undefined;
			const rawDate = match[4] ?? "";
			current = {
				version,
				date: normalizeDate(rawDate),
				compareUrl,
				anchor: formatReleaseAnchor(version, rawDate),
				bodyMarkdown: "",
			};
			bodyLines = [];
			continue;
		}
		if (current) {
			bodyLines.push(line);
		}
	}

	flush();
	return entries;
}

const parsedReleases = parseChangelog(rawChangelog);

/**
 * Returns every release parsed from the repository's root `CHANGELOG.md`.
 */
export function getChangelogReleases(): ChangelogEntry[] {
	return parsedReleases;
}
