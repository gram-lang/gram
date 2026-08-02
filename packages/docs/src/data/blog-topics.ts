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
  "news": {
    name: {
      en: "News",
      fr: "Nouvelles",
    },
    description: {
      en: "The latest announcements, updates, and news from the Gram team.",
      fr: "Les dernières annonces, mises à jour et nouvelles de l'équipe Gram.",
    }
  },
  "announcements": {
    name: {
      en: "Announcements",
      fr: "Annonces",
    },
    description: {
      en: "Important project announcements and milestones.",
      fr: "Annonces importantes et jalons du projet.",
    }
  },
  "testing": {
    name: {
      en: "Testing",
      fr: "Tests",
    },
    description: {
      en: "Articles about testing, QA, and platform stability.",
      fr: "Articles sur les tests, l'assurance qualité et la stabilité de la plateforme.",
    }
  },
  "releases": {
    name: {
      en: "Releases",
      fr: "Sorties",
    },
    description: {
      en: "Release notes and new feature highlights.",
      fr: "Notes de mise à jour et mise en évidence des nouvelles fonctionnalités.",
    }
  },
  "tutorials": {
    name: {
      en: "Tutorials",
      fr: "Tutoriels",
    },
    description: {
      en: "Guides and tutorials for getting the most out of Gram.",
      fr: "Guides et tutoriels pour tirer le meilleur parti de Gram.",
    }
  }
};

/**
 * Normalizes a topic string into a URL-friendly slug.
 */
export function getTopicSlug(topic: string): string {
  return topic.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
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
    }
  };
}
