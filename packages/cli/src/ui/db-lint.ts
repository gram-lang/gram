import chalk from "chalk";
import { log, select, note } from "@clack/prompts";
import {
	NUTRIENTS,
	type IngredientData,
	type NutrientKey,
} from "@gram-lang/analyzer";
import type { LintResult, LintIssue, LintDecision } from "../types";
import { fmtNumber } from "../core/format";

export type NutritionKey = NutrientKey;

/**
 * Every nutrient the database knows about, in the shared display order.
 *
 * This list, its labels and its units were written out by hand and had fallen
 * behind: `mono_fat`, `poly_fat` and `alcohol` were missing, and sodium was
 * labelled as grams when it is stored in milligrams. That mattered beyond
 * cosmetics — `gram db enrich` shows the AI's proposal through
 * `formatNutritionRow` before asking you to accept it, so a nutrient absent
 * here would be written to `ingredients.yaml` without ever being shown.
 */
export const NUTRITION_FIELDS: NutritionKey[] = NUTRIENTS.map((n) => n.key);

// Terse forms, for a one-line terminal row where the full names wouldn't fit.
// Typed against NutrientKey so adding a nutrient to the table fails the build
// here until it gets an abbreviation, rather than silently going unlabelled.
const NUTRITION_LABELS: Record<NutritionKey, string> = {
	calories: "kcal",
	fat: "fat",
	sat_fat: "sat",
	mono_fat: "mono",
	poly_fat: "poly",
	carbs: "carbs",
	sugar: "sugar",
	fiber: "fiber",
	protein: "prot",
	sodium: "sod",
	alcohol: "alc",
};

// Units come from the table itself. Calories are the one case where the terse
// label already carries the unit, so appending it would read "kcal 364kcal".
const NUTRITION_UNITS: Record<NutritionKey, string> = Object.fromEntries(
	NUTRIENTS.map((n) => [n.key, n.key === "calories" ? "" : n.unit]),
) as Record<NutritionKey, string>;

function diffNutritionFields(
	a: IngredientData["nutrition"],
	b: IngredientData["nutrition"],
): NutritionKey[] {
	return NUTRITION_FIELDS.filter(
		(f) => (a?.[f] ?? undefined) !== (b?.[f] ?? undefined),
	);
}

export function formatNutritionRow(
	id: string,
	nutr: IngredientData["nutrition"],
	fields: NutritionKey[],
	padWidth: number,
): string {
	const parts = fields.map((f) => {
		const val = nutr?.[f];
		return `${NUTRITION_LABELS[f]} ${val != null ? `${fmtNumber(val, 1)}${NUTRITION_UNITS[f]}` : "–"}`;
	});
	return `  ${id.padEnd(padWidth)}  ${parts.join("  ")}`;
}

export function renderLintReport(result: LintResult): void {
	if (result.issues.length === 0) {
		log.success(
			"Database looks clean — no duplicates or malformed plurals found.",
		);
		return;
	}

	const plurals = result.issues.filter((i) => i.type === "plural");
	const duplicates = result.issues.filter((i) => i.type === "duplicate");

	console.log();
	if (plurals.length > 0) {
		console.log(chalk.bold("  Plurals detected"));
		for (const issue of plurals) {
			console.log(
				`  ${chalk.yellow("→")} ${issue.suggestion.aliasIds.join(", ")} ${chalk.dim("→")} ${chalk.cyan(issue.suggestion.keepId)}`,
			);
		}
		console.log();
	}

	if (duplicates.length > 0) {
		console.log(chalk.bold("  Semantic duplicates"));
		for (const issue of duplicates) {
			const conflict = issue.hasNutritionConflict
				? chalk.red(" (nutrition conflict)")
				: "";
			console.log(
				`  ${chalk.yellow("→")} ${issue.ids.join(", ")} ${chalk.dim("→")} keep ${chalk.cyan(issue.suggestion.keepId)}${conflict}`,
			);
		}
		console.log();
	}

	log.warn(
		`${result.issues.length} issue${result.issues.length !== 1 ? "s" : ""} detected. ` +
			`Run without --report to fix them.`,
	);
}

export async function promptLintDecisions(
	result: LintResult,
	db: Record<string, IngredientData>,
): Promise<LintDecision[]> {
	const decisions: LintDecision[] = [];
	for (let i = 0; i < result.issues.length; i++) {
		const issue = result.issues[i]!;
		const decision = await promptIssue(i, issue, db);
		decisions.push(decision);
	}
	return decisions;
}

async function promptIssue(
	index: number,
	issue: LintIssue,
	db: Record<string, IngredientData>,
): Promise<LintDecision> {
	const { keepId } = issue.suggestion;

	if (issue.type === "plural") {
		const answer = await select({
			message: `Plural: "${issue.suggestion.aliasIds.join('", "')}" → merge into "${keepId}"?`,
			options: [
				{
					value: "apply",
					label: `Merge — add ${issue.suggestion.aliasIds.map((a) => `"${a}"`).join(", ")} as alias of "${keepId}"`,
					hint: "backward compatible, no breaking changes",
				},
				{ value: "skip", label: "Skip" },
			],
		});
		return {
			issueIndex: index,
			action:
				typeof answer === "symbol" || answer === "skip" ? "skip" : "apply",
		};
	}

	// duplicate — let user choose which key to keep
	const keepAnswer = await select({
		message: `Duplicate: "${issue.ids.join('" and "')}" — which key should be the primary?`,
		options: [
			...issue.ids.map((id) => ({
				value: id,
				label: id === keepId ? `${id}  ${chalk.dim("(AI suggestion)")}` : id,
				hint: `"${issue.ids.find((other) => other !== id)!}" will become an alias`,
			})),
			{ value: "skip", label: "Skip" },
		],
	});

	if (typeof keepAnswer === "symbol" || keepAnswer === "skip") {
		return { issueIndex: index, action: "skip" };
	}

	const chosenKeepId = keepAnswer as string;
	const aliasId = issue.ids.find((id) => id !== chosenKeepId)!;

	if (!issue.hasNutritionConflict) {
		return { issueIndex: index, action: "apply", keepId: chosenKeepId };
	}

	const diffFields = diffNutritionFields(
		db[chosenKeepId]?.nutrition,
		db[aliasId]?.nutrition,
	);

	if (diffFields.length === 0) {
		return { issueIndex: index, action: "apply", keepId: chosenKeepId };
	}

	const padWidth = Math.max(chosenKeepId.length, aliasId.length);
	note(
		formatNutritionRow(
			chosenKeepId,
			db[chosenKeepId]?.nutrition,
			diffFields,
			padWidth,
		) +
			"\n" +
			formatNutritionRow(aliasId, db[aliasId]?.nutrition, diffFields, padWidth),
		"Nutrition diff (per 100g)",
	);

	const nutrition = await select({
		message: `Which values to keep?`,
		options: [
			{ value: "keep", label: `From "${chosenKeepId}"` },
			{ value: "source", label: `From "${aliasId}"` },
		],
	});

	return {
		issueIndex: index,
		action: "apply",
		keepId: chosenKeepId,
		keepNutrition:
			typeof nutrition === "symbol" ? "keep" : (nutrition as "keep" | "source"),
	};
}

export function renderLintSummary(
	result: { applied: number; skipped: number },
	dbPath: string,
): void {
	const { applied, skipped } = result;
	if (applied === 0) {
		log.info("No fixes applied.");
		return;
	}
	log.success(
		`${applied} fix${applied !== 1 ? "es" : ""} applied` +
			(skipped > 0 ? `, ${skipped} skipped` : "") +
			` — ${dbPath}`,
	);
}
