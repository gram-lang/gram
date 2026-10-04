import changelog from "../../../../CHANGELOG.md?raw";

// Each release heading reads `## [1.3.0](<compare url>) - 2026-09-29`, and the
// changelog page slugs it the way Starlight slugs every heading: "130---2026-09-29".
const RELEASE_HEADING =
	/^## \[(\d+\.\d+\.\d+)\]\([^)]*\) - (\d{4}-\d{2}-\d{2})$/gm;

const anchors = new Map<string, string>();
for (const [, version, date] of changelog.matchAll(RELEASE_HEADING)) {
	anchors.set(version!, `${version!.replace(/\./g, "")}---${date}`);
}

/**
 * The anchor of a release on the changelog page, or undefined for a version
 * not released yet (the link then opens the page at the top).
 */
export function changelogAnchor(version: string): string | undefined {
	return anchors.get(version);
}
