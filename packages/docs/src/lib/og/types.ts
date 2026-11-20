export type OgLocale = "en" | "fr";

export type OgAccent = "orange" | "teal" | "amber" | "blue";

export interface OgCodeToken {
	text: string;
	color: string;
}

export type OgCardInput =
	| {
			kind: "home";
			locale: OgLocale;
			version: string;
			title: string;
			subtitle: string;
			description: string;
			recipeTokenLines: OgCodeToken[][];
	  }
	| {
			kind: "blog";
			locale: OgLocale;
			title: string;
			description?: string;
			topicLabel: string;
			topicSlug: string;
			dateLabel?: string;
			author?: string;
			versionTag?: string;
			isIndex?: boolean;
	  }
	| {
			kind: "docs";
			locale: OgLocale;
			title: string;
			description?: string;
			sectionLabel: string;
			breadcrumbPath: string;
			accent: OgAccent;
	  }
	| {
			kind: "playground" | "changelog";
			locale: OgLocale;
			title: string;
			description: string;
			version?: string;
	  };

export interface OgEntry {
	slug: string;
	card: OgCardInput;
}
