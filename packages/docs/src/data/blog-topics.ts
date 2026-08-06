export interface TopicInfo {
	name: {
		en: string;
		fr: string;
	};
	description: {
		en: string;
		fr: string;
	};
}

export const TOPICS: Record<string, TopicInfo> = {
	announcements: {
		name: {
			en: "Announcements",
			fr: "Annonces",
		},
		description: {
			en: "Important news, major updates, and milestones for the Gram project.",
			fr: "L'actualité marquante, les grandes annonces et les étapes clés du projet.",
		},
	},
	releases: {
		name: {
			en: "Releases",
			fr: "Mises à jour",
		},
		description: {
			en: "Release notes, changelogs, and deep dives into new features.",
			fr: "Notes de version, journaux des modifications et présentation des nouveautés.",
		},
	},
	tutorials: {
		name: {
			en: "Tutorials",
			fr: "Tutoriels",
		},
		description: {
			en: "Step-by-step guides and tutorials to help you master Gram.",
			fr: "Guides pratiques et tutoriels pas-à-pas pour apprendre à maîtriser Gram.",
		},
	},
	devlog: {
		name: {
			en: "Devlog",
			fr: "Journal de bord",
		},
		description: {
			en: "A behind-the-scenes look at the development of Gram and its ecosystem.",
			fr: "Les coulisses du développement de Gram, pour suivre le projet de l'intérieur.",
		},
	},
};

/**
 * Normalizes a topic string into a URL-friendly slug.
 */
export function getTopicSlug(topic: string): string {
	return topic
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-");
}

/**
 * Retrieves the topic info by its normalized slug.
 * If not found, it returns a generic fallback.
 */
export function getTopicInfo(slug: string, originalName?: string): TopicInfo {
	const normalizedSlug = getTopicSlug(slug);

	if (TOPICS[normalizedSlug]) {
		return TOPICS[normalizedSlug];
	}

	// Fallback
	const display = originalName || slug;
	return {
		name: {
			en: display,
			fr: display,
		},
		description: {
			en: `Articles related to ${display}.`,
			fr: `Articles liés à ${display}.`,
		},
	};
}
