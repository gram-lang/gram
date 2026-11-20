import { getChangelogReleases } from "./changelog";

const anchors = new Map<string, string>(
	getChangelogReleases().map((entry) => [entry.version, entry.anchor]),
);

/**
 * The anchor of a release on the changelog page, or undefined for a version
 * not released yet (the link then opens the page at the top).
 */
export function changelogAnchor(version: string): string | undefined {
	return anchors.get(version);
}
