import { describe, expect, it } from "bun:test";
import type { CollectionEntry } from "astro:content";
import {
	parseChangelog,
	formatReleaseAnchor,
	getChangelogReleases,
} from "./changelog";
import { changelogAnchor } from "./changelog-anchors";
import {
	getHomepageAnnouncement,
	parseReleaseVersion,
	resolveReleasePostsByVersion,
} from "./releases";

function mockPost(
	id: string,
	locale: "en" | "fr",
	versionDate: string,
	title: string,
	description?: string,
): CollectionEntry<"blog"> {
	return {
		id,
		collection: "blog",
		data: {
			title,
			date: new Date(versionDate),
			locale,
			topic: "Releases",
			description,
		},
	} as CollectionEntry<"blog">;
}

describe("changelog parser", () => {
	it("extracts version, date, compareUrl, and anchor without trailing dividers", () => {
		const sample = [
			"# Changelog",
			"",
			"## [1.4.2](https://example.com/compare/v1.4.1...v1.4.2) - 2026-11-17",
			"",
			"### Bug fixes",
			"- Fixed timer",
			"",
			"---",
			"",
			"## 1.4.0 - 2026-11-13",
			"",
			"### New features",
			"- Added scheduler",
			"",
			"---",
			"",
			"## [1.0.0-beta.5] - 7/26/2026",
			"",
			"### New features",
			"- Added formatter",
		].join("\n");

		const entries = parseChangelog(sample);
		expect(entries).toHaveLength(3);
		expect(entries[0]).toEqual({
			version: "1.4.2",
			date: "2026-11-17",
			compareUrl: "https://example.com/compare/v1.4.1...v1.4.2",
			anchor: "142---2026-11-17",
			bodyMarkdown: "### Bug fixes\n- Fixed timer",
		});
		expect(entries[1]).toEqual({
			version: "1.4.0",
			date: "2026-11-13",
			compareUrl: undefined,
			anchor: "140---2026-11-13",
			bodyMarkdown: "### New features\n- Added scheduler",
		});
		expect(entries[2]).toEqual({
			version: "1.0.0-beta.5",
			date: "2026-07-26",
			compareUrl: undefined,
			anchor: "100-beta5---7262026",
			bodyMarkdown: "### New features\n- Added formatter",
		});
	});

	it("parses all historical releases from root CHANGELOG.md including pre-1.0", () => {
		const all = getChangelogReleases();
		const versions = all.map((entry) => entry.version);
		expect(versions).toContain("1.4.2");
		expect(versions).toContain("1.0.0");
		expect(versions).toContain("1.0.0-beta.5");
		expect(versions).toContain("0.9.0");
	});

	it("formats anchors consistently with Starlight heading slugs", () => {
		expect(formatReleaseAnchor("1.5.0", "2026-12-01")).toBe("150---2026-12-01");
		expect(changelogAnchor("1.4.0")).toBe("140---2026-11-13");
	});
});

describe("release announcement helpers", () => {
	const posts = [
		mockPost(
			"en/2026-11-13-release-140",
			"en",
			"2026-11-13",
			"Release notes - v1.4.0",
			"Run sheet and scheduler",
		),
		mockPost(
			"fr/2026-11-13-release-140",
			"fr",
			"2026-11-13",
			"Notes de version - v1.4.0",
			"Plan de marche",
		),
		mockPost(
			"en/2026-11-17-release-142",
			"en",
			"2026-11-17",
			"Release notes - v1.4.2",
		),
		mockPost(
			"en/2026-08-22-from-markup-to-dsl",
			"en",
			"2026-08-22",
			"From markup to DSL",
		),
	];

	it("parses release versions from Astro slugified glob ids and titles", () => {
		expect(parseReleaseVersion(posts[0])).toBe("1.4.0");
		expect(parseReleaseVersion(posts[3])).toBeUndefined();
	});

	it("maps release posts to localized blog routes", () => {
		const frMap = resolveReleasePostsByVersion(posts, "fr");
		expect(frMap.get("1.4.0")?.href).toBe("/fr/blog/2026-11-13-release-140");
		// Falls back to EN content when no FR post exists, still routed under /fr/blog
		expect(frMap.get("1.4.2")?.href).toBe("/fr/blog/2026-11-17-release-142");
	});

	it("picks the current major.minor release post for the homepage announcement", () => {
		const en = getHomepageAnnouncement(posts, "en", "1.4.2");
		expect(en?.version).toBe("1.4.0");
		expect(en?.href).toBe("/blog/2026-11-13-release-140");

		const fr = getHomepageAnnouncement(posts, "fr", "1.4.2");
		expect(fr?.version).toBe("1.4.0");
		expect(fr?.href).toBe("/fr/blog/2026-11-13-release-140");
	});
});
