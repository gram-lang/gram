import { getCollection } from "astro:content";
import { getHighlighter } from "../../components/playground/shikiHighlighter";
import { getTopicInfo, getTopicSlug } from "../../data/blog-topics";
import { homepageCopy } from "../../data/homepage-copy";
import { GRAM_VERSION } from "../gram-version";
import { resolveLocalizedPosts } from "../resolveLocalizedPosts";
import type { OgAccent, OgCodeToken, OgEntry, OgLocale } from "./types";

export function getHomeOgSlug(locale: OgLocale): string {
	return locale === "fr" ? "fr/home" : "home";
}

export function getPlaygroundOgSlug(locale: OgLocale): string {
	return locale === "fr" ? "fr/play" : "play";
}

export function getChangelogOgSlug(locale: OgLocale): string {
	return locale === "fr" ? "fr/changelog" : "changelog";
}

export function getBlogIndexOgSlug(locale: OgLocale): string {
	return locale === "fr" ? "fr/blog/index" : "blog/index";
}

export function getBlogTopicOgSlug(
	locale: OgLocale,
	topicSlug: string,
): string {
	return locale === "fr"
		? `fr/blog/topic/${topicSlug}`
		: `blog/topic/${topicSlug}`;
}

export function getBlogPostOgSlug(locale: OgLocale, postSlug: string): string {
	return locale === "fr" ? `fr/blog/${postSlug}` : `blog/${postSlug}`;
}

export function getDocOgSlug(entryId: string): string {
	const clean = entryId.replace(/^\/+|\/+$/g, "");
	if (clean === "" || clean === "index" || clean === "docs") {
		return "docs/index";
	}
	if (clean === "fr/docs") {
		return "fr/docs/index";
	}
	return clean;
}

export function ogPathFromSlug(slug: string): string {
	return `/og/${slug}.png`;
}

function inferDocMeta(
	entryId: string,
	locale: OgLocale,
): { sectionLabel: string; accent: OgAccent } {
	const path = entryId.replace(/^fr\//, "");

	if (path === "docs" || path === "docs/index" || path === "") {
		return {
			sectionLabel: locale === "fr" ? "Documentation" : "Documentation",
			accent: "orange",
		};
	}
	if (path.startsWith("docs/tutorials/")) {
		return {
			sectionLabel: locale === "fr" ? "Tutoriels" : "Tutorials",
			accent: "amber",
		};
	}
	if (path.startsWith("docs/how-to/")) {
		return {
			sectionLabel: locale === "fr" ? "Guides pratiques" : "How-to guides",
			accent: "amber",
		};
	}
	if (path.startsWith("docs/reference/syntax/")) {
		return {
			sectionLabel:
				locale === "fr" ? "Référence · Syntaxe" : "Reference · Syntax",
			accent: "orange",
		};
	}
	if (path.startsWith("docs/reference/tooling/")) {
		return {
			sectionLabel:
				locale === "fr" ? "Référence · Outils" : "Reference · Tooling",
			accent: "blue",
		};
	}
	if (path.startsWith("docs/reference/api/")) {
		return {
			sectionLabel: locale === "fr" ? "Référence · API" : "Reference · API",
			accent: "teal",
		};
	}
	if (path.startsWith("docs/explanation/engine/")) {
		return {
			sectionLabel: locale === "fr" ? "Moteur Gram" : "Gram Engine",
			accent: "teal",
		};
	}
	if (path.startsWith("docs/explanation/")) {
		return {
			sectionLabel: locale === "fr" ? "Analyses approfondies" : "Deep dives",
			accent: "blue",
		};
	}
	return {
		sectionLabel: locale === "fr" ? "Documentation" : "Documentation",
		accent: "orange",
	};
}

function extractReleaseVersion(
	title: string,
	slug: string,
): string | undefined {
	const fromSlug = slug.match(
		/release-([0-9]+\.[0-9]+\.[0-9]+(?:[a-z0-9.-]*)?)/i,
	);
	if (fromSlug?.[1]) return `v${fromSlug[1]}`;
	const fromTitle = title.match(/v([0-9]+\.[0-9]+\.[0-9]+(?:[a-z0-9.-]*)?)/i);
	if (fromTitle?.[1]) return `v${fromTitle[1]}`;
	return undefined;
}

function stripHeadlinePrefix(text: string, prefix: string): string {
	return text.startsWith(prefix) ? text.slice(prefix.length).trimStart() : text;
}

async function highlightGramSnippet(code: string): Promise<OgCodeToken[][]> {
	const highlighter = await getHighlighter();
	const { tokens } = highlighter.codeToTokens(code, {
		lang: "gram",
		theme: "github-dark",
	});
	return tokens.slice(0, 5).map((line) =>
		line.map((tok) => ({
			text: tok.content,
			color: tok.color ?? "#e1e4e8",
		})),
	);
}

export async function getAllOgEntries(): Promise<OgEntry[]> {
	const entries: OgEntry[] = [];

	// 1. Homepages (EN & FR)
	for (const locale of ["en", "fr"] as const) {
		const copy = homepageCopy[locale];
		const recipeTokenLines = await highlightGramSnippet(copy.recipeCode);
		entries.push({
			slug: getHomeOgSlug(locale),
			card: {
				kind: "home",
				locale,
				version: GRAM_VERSION,
				title: copy.heroTitle,
				subtitle: copy.heroSubtitle,
				description: stripHeadlinePrefix(
					copy.metaDescription,
					copy.heroSubtitle,
				),
				recipeTokenLines,
			},
		});
	}

	// 2. Playground & Changelog (EN & FR)
	entries.push(
		{
			slug: getPlaygroundOgSlug("en"),
			card: {
				kind: "playground",
				locale: "en",
				title: "Gram Playground",
				description:
					"Write Gram recipes in your browser and inspect the AST, compiled JSON, run sheet, and rendered views live.",
				version: GRAM_VERSION,
			},
		},
		{
			slug: getPlaygroundOgSlug("fr"),
			card: {
				kind: "playground",
				locale: "fr",
				title: "Playground Gram",
				description:
					"Écrivez des recettes Gram dans votre navigateur et visualisez en direct l'AST, le JSON compilé et le plan de marche.",
				version: GRAM_VERSION,
			},
		},
		{
			slug: getChangelogOgSlug("en"),
			card: {
				kind: "changelog",
				locale: "en",
				title: "Changelog",
				description:
					"Full release history of Gram: release notes, new features, fixes, and deprecations.",
				version: GRAM_VERSION,
			},
		},
		{
			slug: getChangelogOgSlug("fr"),
			card: {
				kind: "changelog",
				locale: "fr",
				title: "Changelog",
				description:
					"Historique complet des versions de Gram : articles de release, nouveautés, correctifs et dépréciations.",
				version: GRAM_VERSION,
			},
		},
	);

	// 3. Blog index, topics, and posts (EN & FR)
	const allPosts = await getCollection("blog");

	entries.push(
		{
			slug: getBlogIndexOgSlug("en"),
			card: {
				kind: "blog",
				locale: "en",
				title: "Gram Blog",
				description:
					"Latest updates, release notes, tutorials, and engineering notes from the Gram project.",
				topicLabel: "Blog",
				topicSlug: "announcements",
				isIndex: true,
			},
		},
		{
			slug: getBlogIndexOgSlug("fr"),
			card: {
				kind: "blog",
				locale: "fr",
				title: "Blog Gram",
				description:
					"Dernières nouveautés, notes de version, tutoriels et coulisses techniques du projet Gram.",
				topicLabel: "Blog",
				topicSlug: "announcements",
				isIndex: true,
			},
		},
	);

	const enPosts = allPosts.filter((post) => post.data.locale === "en");
	const frPosts = resolveLocalizedPosts(allPosts, "fr");

	const topicGroups: Array<{ locale: OgLocale; posts: typeof enPosts }> = [
		{ locale: "en", posts: enPosts },
		{ locale: "fr", posts: frPosts },
	];

	for (const { locale, posts } of topicGroups) {
		const seenTopics = new Set<string>();
		for (const post of posts) {
			const postSlug = post.id.replace(/^(en|fr)\//, "").replace(/\.md$/, "");
			const topicSlug = getTopicSlug(post.data.topic);
			const topicInfo = getTopicInfo(topicSlug, post.data.topic);
			const topicLabel = topicInfo.name[locale];

			entries.push({
				slug: getBlogPostOgSlug(locale, postSlug),
				card: {
					kind: "blog",
					locale,
					title: post.data.title,
					description: post.data.description,
					topicLabel,
					topicSlug,
					dateLabel: post.data.date.toLocaleDateString(
						locale === "fr" ? "fr-FR" : "en-US",
						{ year: "numeric", month: "long", day: "numeric" },
					),
					versionTag:
						topicSlug === "releases"
							? extractReleaseVersion(post.data.title, postSlug)
							: undefined,
				},
			});

			if (!seenTopics.has(topicSlug)) {
				seenTopics.add(topicSlug);
				entries.push({
					slug: getBlogTopicOgSlug(locale, topicSlug),
					card: {
						kind: "blog",
						locale,
						title: topicInfo.name[locale],
						description: topicInfo.description[locale],
						topicLabel: locale === "fr" ? "Sujet" : "Topic",
						topicSlug,
						isIndex: true,
					},
				});
			}
		}
	}

	// 4. Starlight documentation pages
	const docs = await getCollection("docs");
	for (const entry of docs) {
		const locale: OgLocale = entry.id.startsWith("fr/") ? "fr" : "en";
		const { sectionLabel, accent } = inferDocMeta(entry.id, locale);
		entries.push({
			slug: getDocOgSlug(entry.id),
			card: {
				kind: "docs",
				locale,
				title: entry.data.title,
				description: entry.data.description,
				sectionLabel,
				breadcrumbPath: `/${entry.id.replace(/^\/+/, "")}`,
				accent,
			},
		});
	}

	return entries;
}
