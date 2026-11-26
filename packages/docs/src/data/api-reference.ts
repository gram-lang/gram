// Single source of truth for the API Reference tables, computed directly from
// the packages' own exports (no intermediate generated markdown files — see
// migration plan Phase 6.5).
import { canonicalFrontmatterKeys } from "@gram-lang/kitchen";
import { allWarningInfo } from "@gram-lang/modules";
import { ASTNodeType } from "@gram-lang/parser";
import {
	UNIT_DICTIONARIES,
	TIME_DICTIONARIES,
	UNIT_CONVERSIONS,
	getDefaultCategories,
	getDictionary,
} from "@gram-lang/i18n";

export type Locale = "en" | "fr";

export interface Table {
	headers: string[];
	rows: string[][];
}

// Renders each warning's template with a placeholder proxy standing in for
// its payload, so the table shows real message shapes (e.g. "Variable
// '{targetName}' not found.") without needing real payload data.
const payloadProxy = new Proxy(
	{},
	{ get: (_t, prop) => `{${String(prop)}}` },
) as never;

const WARNING_LABELS: Record<Locale, string[]> = {
	en: ["Code", "Severity", "Message template"],
	fr: ["Code", "Sévérité", "Modèle de message"],
};

export function warningCodesTable(locale: Locale): Table {
	return {
		headers: WARNING_LABELS[locale],
		rows: allWarningInfo.map(({ code, severity, template }) => [
			`\`${code}\``,
			severity,
			`\`${template(payloadProxy)}\``,
		]),
	};
}

const FRONTMATTER_LABELS: Record<
	Locale,
	{ headers: string[]; functional: string; informational: string }
> = {
	en: {
		headers: ["Key", "Role", "Value", "Meaning", "Example"],
		functional: "Functional",
		informational: "Informational",
	},
	fr: {
		headers: ["Clé", "Rôle", "Valeur", "Sens", "Exemple"],
		functional: "Fonctionnelle",
		informational: "Informative",
	},
};

/**
 * The frontmatter keys to write today, from kitchen's `FRONTMATTER_KEYS`:
 * functional keys first. Deprecated keys are left out (they are documented
 * once, in their own caution, never as aliases).
 */
export function frontmatterKeysTable(locale: Locale): Table {
	const labels = FRONTMATTER_LABELS[locale];
	const t = getDictionary(locale).frontmatter;
	const keys = canonicalFrontmatterKeys().sort(
		(a, b) => Number(a.role !== "functional") - Number(b.role !== "functional"),
	);
	return {
		headers: labels.headers,
		rows: keys.map((def) => [
			`\`${def.key}\``,
			labels[def.role],
			t.values[def.value] as string,
			t.keys[def.key] as string,
			`\`${def.example}\``,
		]),
	};
}

const AST_LABELS: Record<Locale, string[]> = {
	en: ["Value"],
	fr: ["Valeur"],
};

export function astNodeTypesTable(locale: Locale): Table {
	return {
		headers: AST_LABELS[locale],
		rows: Object.values(ASTNodeType).map((v) => [`\`${v}\``]),
	};
}

const UNITS_LABELS: Record<Locale, string[]> = {
	en: ["Canonical", "Aliases"],
	fr: ["Canonique", "Alias"],
};

export function unitsTable(locale: Locale): Table {
	const dict = UNIT_DICTIONARIES[locale];
	return {
		headers: UNITS_LABELS[locale],
		rows: Object.entries(dict).map(([canonical, aliases]) => [
			`\`${canonical}\``,
			aliases.map((a) => `\`${a}\``).join(", "),
		]),
	};
}

const TIME_LABELS: Record<Locale, string[]> = {
	en: ["Canonical", "Aliases"],
	fr: ["Canonique", "Alias"],
};

export function timeUnitsTable(locale: Locale): Table {
	const dict = TIME_DICTIONARIES[locale];
	return {
		headers: TIME_LABELS[locale],
		rows: Object.entries(dict).map(([canonical, aliases]) => [
			`\`${canonical}\``,
			aliases.map((a) => `\`${a}\``).join(", "),
		]),
	};
}

const CONVERSIONS_LABELS: Record<Locale, string[]> = {
	en: ["Family", "Unit", "Factor (relative to base)"],
	fr: ["Famille", "Unité", "Facteur (par rapport à la base)"],
};

export function unitConversionsTable(locale: Locale): Table {
	const rows: string[][] = [];
	for (const [family, def] of Object.entries(UNIT_CONVERSIONS)) {
		for (const [unit, factor] of Object.entries(def.map)) {
			rows.push([
				`\`${family}\` (base: \`${def.base}\`)`,
				`\`${unit}\``,
				String(factor),
			]);
		}
	}
	return { headers: CONVERSIONS_LABELS[locale], rows };
}

const CATEGORIES_LABELS: Record<Locale, string[]> = {
	en: ["Default categories"],
	fr: ["Catégories par défaut"],
};

export function categoriesTable(locale: Locale): Table {
	return {
		headers: CATEGORIES_LABELS[locale],
		rows: getDefaultCategories(locale).map((c) => [c]),
	};
}
