/**
 * The frontmatter keys Gram gives a meaning to: the one list the compiler
 * (deprecation warnings), the renderer (which keys are not the author's own
 * metadata), the language server (completion, hover) and the docs (the table
 * of keys) read. The parser accepts any `key: value` line; a key not listed
 * here is the author's own metadata, shown as is.
 *
 * Words a reader sees (what a key means, what its value is) live in
 * `@gram-lang/i18n`, under `frontmatter.keys.<key>` and
 * `frontmatter.values.<value>`, never here.
 */

/**
 * `functional`: the compiler, the analyzer or the views compute something
 * from it (scaling, nutrition, densities, the language of units and views).
 * `informational`: shown, never computed with.
 */
export type FrontmatterKeyRole = "functional" | "informational";

/** The kind of value a key takes, as written in the frontmatter. */
export type FrontmatterValueKind =
	| "text"
	| "number"
	| "list"
	| "date"
	| "languageTag"
	| "densities";

export interface FrontmatterKeyDefinition {
	key: string;
	role: FrontmatterKeyRole;
	value: FrontmatterValueKind;
	/** A whole frontmatter line, as an author writes it. */
	example: string;
	/**
	 * Set on a key that still works but should no longer be written:
	 * `replacement` is the canonical key to write instead, which wins when
	 * both are present.
	 */
	deprecated?: { replacement: string };
}

export const FRONTMATTER_KEYS: readonly FrontmatterKeyDefinition[] = [
	{
		key: "title",
		role: "informational",
		value: "text",
		example: "title: 'Matcha brownies'",
	},
	{
		key: "description",
		role: "informational",
		value: "text",
		example: "description: 'A soft, Japanese-style brownie'",
	},
	{
		key: "tags",
		role: "informational",
		value: "list",
		example: "tags: ['brownie', 'matcha']",
	},
	{
		key: "category",
		role: "informational",
		value: "text",
		example: "category: 'Dessert'",
	},
	{
		key: "author",
		role: "informational",
		value: "list",
		example: "author: ['Auguste Kerflec']",
	},
	{
		key: "source",
		role: "informational",
		value: "list",
		example: "source: ['https://example.com/matcha-brownie']",
	},
	{
		key: "date",
		role: "informational",
		value: "date",
		example: "date: 2026-06-07",
	},
	{
		key: "lastUpdated",
		role: "informational",
		value: "date",
		example: "lastUpdated: 2026-11-26",
	},
	{
		key: "makes",
		role: "informational",
		value: "text",
		example: "makes: '20x20 cm mold'",
	},
	{
		key: "notes",
		role: "informational",
		value: "text",
		example: "notes: 'Less sugar next time.'",
	},
	{
		key: "portions",
		role: "functional",
		value: "number",
		example: "portions: 4",
	},
	{
		key: "densities",
		role: "functional",
		value: "densities",
		example: "densities: [flour:0.55, milk:1.03]",
	},
	{
		key: "language",
		role: "functional",
		value: "languageTag",
		example: "language: fr",
	},
	// @remove-in: 2.0.0 [frontmatter-servings-yield]
	{
		key: "servings",
		// Only ever shown by the HTML recipe: scaling and nutrition read `portions`.
		role: "informational",
		value: "number",
		example: "servings: 4",
		deprecated: { replacement: "portions" },
	},
	// @remove-in: 2.0.0 [frontmatter-servings-yield]
	{
		key: "yield",
		role: "informational",
		value: "text",
		example: "yield: '24 cookies'",
		deprecated: { replacement: "makes" },
	},
	// @remove-in: 2.0.0 [frontmatter-servings-yield]
	{
		key: "yields",
		role: "informational",
		value: "text",
		example: "yields: '24 cookies'",
		deprecated: { replacement: "makes" },
	},
];

const BY_KEY = new Map(FRONTMATTER_KEYS.map((def) => [def.key, def]));

/** The definition of a frontmatter key Gram knows, deprecated ones included. */
export function frontmatterKey(
	key: string,
): FrontmatterKeyDefinition | undefined {
	return BY_KEY.get(key);
}

/** The keys to write today: every key of the registry but the deprecated ones. */
export function canonicalFrontmatterKeys(): FrontmatterKeyDefinition[] {
	return FRONTMATTER_KEYS.filter((def) => !def.deprecated);
}
