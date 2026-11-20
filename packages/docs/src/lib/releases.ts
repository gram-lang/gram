import type { CollectionEntry } from "astro:content";
import { resolveLocalizedPosts } from "./resolveLocalizedPosts";

export interface ReleasePostInfo {
	version: string;
	slug: string;
	href: string;
	title: string;
	description?: string;
	date: Date;
}

export interface HomepageAnnouncement {
	version: string;
	href: string;
	title: string;
	description?: string;
}

const RELEASE_ID_DOTTED = /-release-(\d+\.\d+\.\d+(?:beta\d+)?)(?:\.md)?$/;
const RELEASE_TITLE_VERSION = /\bv(\d+\.\d+\.\d+(?:-beta\.\d+)?)\b/i;

/**
 * Extracts the semantic version string from a blog release entry.
 * Astro's `glob()` loader strips dots from file ids (e.g. `2026-11-13-release-140`),
 * so when `id` carries `-release-` without dots we read the exact dotted version
 * from the entry's `title` (e.g. `"Release notes - v1.4.0"`).
 */
export function parseReleaseVersion(
	post: Pick<CollectionEntry<"blog">, "id" | "data">,
): string | undefined {
	const dotted = post.id.match(RELEASE_ID_DOTTED);
	if (dotted?.[1]) return dotted[1];

	if (!post.id.includes("-release-")) return undefined;
	const fromTitle = post.data.title.match(RELEASE_TITLE_VERSION);
	return fromTitle?.[1];
}

function entrySlug(id: string): string {
	return id.replace(/^(en|fr)\//, "").replace(/\.md$/, "");
}

/**
 * Indexes localized release blog posts by version string, falling back to
 * English posts when no translation exists for the target locale.
 */
export function resolveReleasePostsByVersion(
	allPosts: CollectionEntry<"blog">[],
	locale: "en" | "fr",
): Map<string, ReleasePostInfo> {
	const posts =
		locale === "fr"
			? resolveLocalizedPosts(allPosts, "fr")
			: allPosts.filter((p) => p.data.locale === "en");

	const prefix = locale === "fr" ? "/fr/blog" : "/blog";
	const byVersion = new Map<string, ReleasePostInfo>();

	for (const post of posts) {
		const version = parseReleaseVersion(post);
		if (!version) continue;
		const slug = entrySlug(post.id);
		byVersion.set(version, {
			version,
			slug,
			href: `${prefix}/${slug}`,
			title: post.data.title,
			description: post.data.description,
			date: post.data.date,
		});
	}

	return byVersion;
}

/**
 * Returns the release post matching the active major.minor milestone (e.g.
 * `1.4.0` when running `1.4.x`, or `1.5.0` when `1.5.x`), falling back to the
 * most recent `.0` release post if none matches the current version yet.
 */
export function getHomepageAnnouncement(
	allPosts: CollectionEntry<"blog">[],
	locale: "en" | "fr",
	currentVersion: string,
): HomepageAnnouncement | undefined {
	const byVersion = resolveReleasePostsByVersion(allPosts, locale);
	const minorMatch = currentVersion.match(/^(\d+\.\d+)\./);
	const targetMinorZero = minorMatch ? `${minorMatch[1]}.0` : undefined;

	let post =
		(targetMinorZero ? byVersion.get(targetMinorZero) : undefined) ??
		byVersion.get(currentVersion);

	if (!post) {
		const minorPosts = [...byVersion.values()]
			.filter((entry) => /^\d+\.\d+\.0$/.test(entry.version))
			.sort((a, b) => b.date.valueOf() - a.date.valueOf());
		post = minorPosts[0];
	}

	if (!post) return undefined;

	return {
		version: post.version,
		href: post.href,
		title: post.title,
		description: post.description,
	};
}
