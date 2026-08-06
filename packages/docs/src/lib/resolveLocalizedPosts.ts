import type { CollectionEntry } from "astro:content";

/**
 * Returns one entry per English blog post, using its localized translation
 * when one exists (matched by shared basename, e.g. en/welcome.md <-> fr/welcome.md)
 * and falling back to the English post otherwise.
 */
export function resolveLocalizedPosts(
	allPosts: CollectionEntry<"blog">[],
	locale: string,
): CollectionEntry<"blog">[] {
	const englishPosts = allPosts.filter((post) => post.data.locale === "en");
	const localizedPosts = allPosts.filter((post) => post.data.locale === locale);

	return englishPosts.map((enPost) => {
		const baseId = enPost.id.replace(/^en\//, "");
		const localizedPost = localizedPosts.find(
			(p) => p.id === `${locale}/${baseId}`,
		);
		return localizedPost ?? enPost;
	});
}
