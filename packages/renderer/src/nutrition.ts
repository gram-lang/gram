// `./nutrients` rather than the package root: the root barrel builds zod
// schemas at module load, which a bundler can't drop, and this module is
// reached by browser bundles (the docs playground, the VS Code webview).
import { NUTRIENTS } from "@gram-lang/analyzer/nutrients";
import type { NutritionMetrics } from "@gram-lang/analyzer";
import { getDictionary } from "@gram-lang/i18n";
import type {
	NutritionBasis,
	RenderableCompilationResult,
	RenderableMetrics,
} from "./types";

/**
 * The one narrowing point for `data.metrics`, previously repeated verbatim in
 * every formatter. See RenderableMetrics for why the cast is the honest model
 * rather than a shortcut.
 */
export function getMetrics(
	data: RenderableCompilationResult,
): RenderableMetrics | undefined {
	return data.metrics as RenderableMetrics | undefined;
}

/**
 * Whether there is anything worth showing at all.
 *
 * "Any calories, or any warning" — a recipe whose ingredients are all missing
 * from the database has nothing to total but very much has something to say,
 * and hiding the panel would leave the cook wondering why. The print backend
 * used to apply a stricter rule and silently dropped that case.
 */
export function hasNutritionToShow(nut: NutritionMetrics | undefined): boolean {
	if (!nut) return false;
	return (nut.total?.calories ?? 0) > 0 || (nut.warnings?.length ?? 0) > 0;
}

/**
 * Stand-in when a payload carries no totals at all — every required nutrient at
 * zero, built from the table so it can't fall out of step with `Macros`.
 */
const EMPTY_MACROS = Object.fromEntries(
	NUTRIENTS.filter((n) => n.required).map((n) => [n.key, 0]),
) as NutritionMetrics["total"];

export interface ResolvedBasis {
	key: Exclude<NutritionBasis, "auto">;
	values: NutritionMetrics["total"];
	label: string;
	/** Set for per-100 g: the raw-mass caveat, already localized. */
	note?: string;
}

function massNote(nut: NutritionMetrics, lang?: string): string | undefined {
	const basis = nut.basis;
	if (!basis) return undefined;
	const t = getDictionary(lang);

	// Same convention the metadata grid uses for totalMass: "~" when the mass
	// leans on estimated conversions, ">" when some of it couldn't be resolved
	// at all and the figure is therefore a lower bound — which makes the
	// density an over-estimate, not an under-estimate.
	const prefix =
		basis.massStatus === "estimated"
			? "~"
			: basis.massStatus === "incomplete"
				? ">"
				: "";

	// `basis.mass` is the mass that actually contributed macros. At full
	// coverage that is the recipe's whole raw weight and reads naturally; below
	// it, the same sentence would suggest the recipe weighs less than it does,
	// so the wording says outright that this is only the part with data.
	const template =
		nut.coverage < 1
			? t.renderer.nutritionRawMassNotePartial
			: t.renderer.nutritionRawMassNote;

	return template.replace("{mass}", `${prefix}${Math.round(basis.mass)} g`);
}

/**
 * The bases this recipe actually has, in the order a reader would step through
 * them. Used directly by the interactive HTML panel, and as the lookup table
 * the static backends resolve a single choice from.
 */
export function availableBases(
	nut: NutritionMetrics,
	lang?: string,
): ResolvedBasis[] {
	const t = getDictionary(lang);
	const bases: ResolvedBasis[] = [];

	if (nut.perPortion) {
		bases.push({
			key: "perPortion",
			values: nut.perPortion,
			label: t.renderer.nutritionPerPortion,
		});
	}
	if (nut.per100g) {
		bases.push({
			key: "per100g",
			values: nut.per100g,
			label: t.renderer.nutritionPer100g,
			note: massNote(nut, lang),
		});
	}
	bases.push({
		key: "total",
		// `total` is required by the type, but the renderer's input is the
		// analyzer's JSON as it arrives — a hand-built or truncated payload can
		// carry warnings and no totals, and that used to render (as zeroes)
		// rather than throw. Always ending the list with a usable entry is also
		// what lets resolveNutritionBasis() treat the last one as its fallback.
		values: nut.total ?? EMPTY_MACROS,
		label: t.renderer.nutritionWholeRecipe,
	});

	return bases;
}

/**
 * Picks the basis a static backend should render.
 *
 * The three backends each used to inline their own version of this, with
 * different fallbacks, so the same recipe could be labelled per-portion in one
 * output and whole-recipe in another. A requested basis the recipe doesn't
 * have (per-100 g with no resolvable mass) falls back rather than rendering
 * nothing.
 *
 * "auto" resolves to per-portion when the recipe declares a portion count and
 * the whole recipe otherwise — deliberately *not* "the first available basis",
 * which would silently switch existing unportioned recipes over to per-100 g.
 * Per-100 g stays something a caller asks for, or a reader toggles to.
 */
export function resolveNutritionBasis(
	nut: NutritionMetrics,
	requested: NutritionBasis = "auto",
	lang?: string,
): ResolvedBasis {
	const bases = availableBases(nut, lang);
	// availableBases always ends with "total", so this is never undefined.
	const total = bases[bases.length - 1] as ResolvedBasis;
	const wanted = requested === "auto" ? "perPortion" : requested;
	return bases.find((b) => b.key === wanted) ?? total;
}

export interface NutrientRow {
	key: string;
	label: string;
	value: number;
	unit: string;
	/** True for a sub-macro ("of which sugars"), which reads indented. */
	nested: boolean;
}

/**
 * Turns a macro profile into display rows, driven by NUTRIENTS.
 *
 * The three backends used to hard-code their own list of nutrients — with
 * different subsets, so print silently omitted sugars — and their own units.
 * Both now come from the table, which is also what makes fat subtypes and
 * alcohol appear everywhere at once now that the aggregation reports them.
 */
export function nutritionRows(
	values: NutritionMetrics["total"] | undefined,
	lang?: string,
): NutrientRow[] {
	const t = getDictionary(lang);
	const rows: NutrientRow[] = [];
	if (!values) return rows;

	for (const nutrient of NUTRIENTS) {
		const value = values[nutrient.key];
		if (value === undefined) continue;
		const name = t.renderer.nutrients[nutrient.key];
		rows.push({
			key: nutrient.key,
			label: nutrient.parent ? `${t.renderer.ofWhich} ${name}` : name,
			value,
			unit: nutrient.unit,
			nested: Boolean(nutrient.parent),
		});
	}

	return rows;
}

export interface NutrientGroup extends NutrientRow {
	/** Sub-macros of this nutrient, in table order. Empty for most. */
	children: NutrientRow[];
}

/**
 * The same rows, with each sub-macro folded into its parent.
 *
 * A card grid reads badly flat: "of which saturates" sitting in its own cell,
 * the same size as "Protein", loses the fact that it is *part of* the fat
 * beside it. Backends that lay nutrients out as blocks group them; the
 * terminal and Markdown, which are already vertical lists, keep the flat rows
 * and indent instead.
 *
 * A sub-macro whose parent is absent from the data is promoted to a group of
 * its own rather than dropped — the database requires `fat` and `carbs`
 * whenever a nutrition block exists, so this shouldn't happen, but losing a
 * value silently would be the wrong way to find out.
 */
export function nutritionGroups(
	values: NutritionMetrics["total"] | undefined,
	lang?: string,
): NutrientGroup[] {
	const parentOf = new Map(NUTRIENTS.map((n) => [n.key as string, n.parent]));
	const groups: NutrientGroup[] = [];
	const byKey = new Map<string, NutrientGroup>();

	for (const row of nutritionRows(values, lang)) {
		const parent = parentOf.get(row.key);
		const target = parent ? byKey.get(parent) : undefined;
		if (target) {
			target.children.push(row);
			continue;
		}
		const group: NutrientGroup = { ...row, children: [] };
		groups.push(group);
		byKey.set(row.key, group);
	}

	return groups;
}
