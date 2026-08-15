import chalk from "chalk";
import { log, select, text, note, isCancel } from "@clack/prompts";
import { relative } from "node:path";
import type {
	EnrichEntry,
	EnrichResult,
	EnrichWriteResult,
	EnrichDecision,
	EnrichFieldGroupDecision,
} from "../types";
import { fmtNumber } from "../core/format";
import { formatNutritionRow, NUTRITION_FIELDS } from "./db-lint";

export function formatEntrySummary(entry: EnrichEntry): string {
	const parts: string[] = [];
	if (entry.category) parts.push(entry.category);
	if (entry.density != null)
		parts.push(`density: ${fmtNumber(entry.density)} g/mL`);
	if (entry.unit_weight != null)
		parts.push(`unit weight: ${fmtNumber(entry.unit_weight)} g`);
	if (entry.nutrition != null)
		parts.push(`${fmtNumber(entry.nutrition.calories)} kcal/100g`);
	return parts.join(" · ");
}

// Sole implementation of "accept this entry's AI estimates as-is" — shared by
// `--yes`, the non-TTY fallback, `--field tags`/`category` (which have no
// physical/nutrition to review), and "accept all remaining" mid-review.
// Values are the AI's own, verbatim, so `applyEnrichDecisions` tags them
// `[LLM]` by construction (final value === AI value).
export function buildAcceptDecision(
	entry: EnrichEntry,
	entryIndex: number,
): EnrichDecision {
	return {
		entryIndex,
		physical:
			entry.density != null || entry.unit_weight != null
				? {
						action: "write",
						density: entry.density,
						unit_weight: entry.unit_weight,
					}
				: null,
		nutrition:
			entry.nutrition != null
				? { action: "write", nutrition: entry.nutrition }
				: null,
	};
}

export function renderEnrichResult(
	result: EnrichResult,
	write: EnrichWriteResult,
): void {
	const { enriched, failed, totalIncomplete, dbPath } = result;
	const relPath = relative(process.cwd(), dbPath) || dbPath;

	if (totalIncomplete === 0) {
		log.success("All ingredients already complete — nothing to enrich.");
		return;
	}

	console.log();
	for (const entry of enriched) {
		console.log(
			`  ${chalk.green("✓")} ${entry.name.padEnd(22)} ${chalk.dim(formatEntrySummary(entry))}`,
		);
	}
	for (const id of failed) {
		console.log(
			`  ${chalk.red("✗")} ${id.padEnd(22)} ${chalk.dim("invalid response — skipped")}`,
		);
	}
	console.log();

	// "Updated" is only ever printed by reading `write.written` — never
	// inferred from `enriched.length` being non-zero, which used to lie
	// whenever the write itself was silently skipped underneath (or, now,
	// whenever every entry was skipped/canceled during review).
	if (!write.written) {
		log.warn(`Nothing written to ${chalk.dim(relPath)} — ${write.reason}.`);
	} else {
		const n = write.count;
		const f = failed.length;
		log.success(
			`Updated ${chalk.dim(relPath)} (${n} ingredient${n !== 1 ? "s" : ""} enriched${f ? `, ${f} failed` : ""})`,
		);
		if (f > 0) {
			console.log(
				chalk.dim(
					`  → Review failed ingredients manually or re-run \`gram db enrich --ingredient <slug>\``,
				),
			);
		}
	}
}

// `--report`/`--dry-run` mode: lists entries that *need* review without
// deciding or writing anything, mirroring `renderLintReport`.
export function renderEnrichPreview(result: EnrichResult): void {
	const { enriched, failed, totalIncomplete } = result;

	if (totalIncomplete === 0) {
		log.success("All ingredients already complete — nothing to enrich.");
		return;
	}

	console.log();
	for (const entry of enriched) {
		console.log(
			`  ${chalk.yellow("→")} ${entry.name.padEnd(22)} ${chalk.dim(formatEntrySummary(entry))}`,
		);
	}
	for (const id of failed) {
		console.log(
			`  ${chalk.red("✗")} ${id.padEnd(22)} ${chalk.dim("invalid response — skipped")}`,
		);
	}
	console.log();

	log.warn(
		`${enriched.length} ingredient${enriched.length !== 1 ? "s" : ""} ready for review. ` +
			`Run without --report/--dry-run to review and write them.`,
	);
}

function formatPhysicalRow(
	label: string,
	density: number | undefined,
	unit_weight: number | undefined,
	padWidth: number,
): string {
	const parts: string[] = [];
	if (density != null) parts.push(`density ${fmtNumber(density)} g/mL`);
	if (unit_weight != null)
		parts.push(`unit_weight ${fmtNumber(unit_weight)} g`);
	return `  ${label.padEnd(padWidth)}  ${parts.join("  ")}`;
}

const CANCELED = Symbol("canceled");

async function promptNumberField(
	message: string,
	current: number,
): Promise<number | typeof CANCELED> {
	const answer = await text({ message, initialValue: String(current) });
	if (isCancel(answer)) return CANCELED;
	const parsed = Number.parseFloat(answer);
	return Number.isFinite(parsed) ? parsed : current;
}

async function promptEdit(
	entry: EnrichEntry,
	entryIndex: number,
	hasPhysical: boolean,
	hasNutrition: boolean,
): Promise<EnrichDecision | "cancel"> {
	let editPhysical = hasPhysical;
	let editNutrition = hasNutrition;

	if (hasPhysical && hasNutrition) {
		const which = await select({
			message: "Edit what?",
			options: [
				{ value: "both", label: "Physical & nutrition" },
				{ value: "physical", label: "Physical only" },
				{ value: "nutrition", label: "Nutrition only" },
			],
		});
		if (isCancel(which)) return "cancel";
		editPhysical = which === "both" || which === "physical";
		editNutrition = which === "both" || which === "nutrition";
	}

	let physical: EnrichFieldGroupDecision | null = null;
	if (hasPhysical) {
		let density = entry.density;
		let unit_weight = entry.unit_weight;
		if (editPhysical) {
			if (density != null) {
				const v = await promptNumberField("Density (g/mL)", density);
				if (v === CANCELED) return "cancel";
				density = v;
			}
			if (unit_weight != null) {
				const v = await promptNumberField("Unit weight (g)", unit_weight);
				if (v === CANCELED) return "cancel";
				unit_weight = v;
			}
		}
		physical = { action: "write", density, unit_weight };
	}

	let nutrition: EnrichFieldGroupDecision | null = null;
	if (hasNutrition && entry.nutrition) {
		const values = { ...entry.nutrition };
		if (editNutrition) {
			for (const field of NUTRITION_FIELDS) {
				const current = values[field];
				if (current == null) continue;
				const v = await promptNumberField(field, current);
				if (v === CANCELED) return "cancel";
				values[field] = v;
			}
		}
		nutrition = { action: "write", nutrition: values };
	}

	const padWidth = "before".length;
	const noteLines: string[] = [];
	if (editPhysical) {
		noteLines.push(
			formatPhysicalRow("before", entry.density, entry.unit_weight, padWidth),
		);
		noteLines.push(
			formatPhysicalRow(
				"after",
				physical?.density,
				physical?.unit_weight,
				padWidth,
			),
		);
	}
	if (editNutrition) {
		noteLines.push(
			formatNutritionRow("before", entry.nutrition, NUTRITION_FIELDS, padWidth),
		);
		noteLines.push(
			formatNutritionRow(
				"after",
				nutrition?.nutrition ?? entry.nutrition,
				NUTRITION_FIELDS,
				padWidth,
			),
		);
	}
	if (noteLines.length > 0) {
		note(noteLines.join("\n"), `${entry.name} — will write`);
	}

	return { entryIndex, physical, nutrition };
}

async function promptEntry(
	entry: EnrichEntry,
	entryIndex: number,
): Promise<EnrichDecision | "cancel" | "accept-rest"> {
	const hasPhysical = entry.density != null || entry.unit_weight != null;
	const hasNutrition = entry.nutrition != null;

	// Nothing to review for this entry (only category/tags, if anything) —
	// treat it like an automatic accept rather than prompting for nothing.
	if (!hasPhysical && !hasNutrition) {
		return buildAcceptDecision(entry, entryIndex);
	}

	// Shows the full AI proposal — not just the terse calories-only summary
	// used elsewhere for post-hoc listings — so the decision below is actually
	// informed. Without this, a nutrition-heavy entry only ever showed its
	// calorie count before "Accept AI estimate", meaning carbs/protein/fat/etc.
	// got written unreviewed even in the "reviewed" path.
	const padWidth = Math.max("physical".length, "nutrition".length);
	const proposalLines: string[] = [];
	if (hasPhysical) {
		proposalLines.push(
			formatPhysicalRow("physical", entry.density, entry.unit_weight, padWidth),
		);
	}
	if (hasNutrition) {
		proposalLines.push(
			formatNutritionRow(
				"nutrition",
				entry.nutrition,
				NUTRITION_FIELDS,
				padWidth,
			),
		);
	}
	note(
		proposalLines.join("\n"),
		`${entry.name}${entry.category ? ` (${entry.category})` : ""} — AI proposal`,
	);

	const answer = await select({
		message: entry.name,
		initialValue: "accept",
		options: [
			{ value: "accept", label: "Accept AI estimate" },
			{ value: "edit", label: "Enter manually" },
			{ value: "skip", label: "Skip" },
			{ value: "accept-rest", label: "Accept all remaining automatically" },
		],
	});
	if (isCancel(answer)) return "cancel";

	if (answer === "accept-rest") return "accept-rest";
	if (answer === "accept") return buildAcceptDecision(entry, entryIndex);
	if (answer === "skip") {
		return {
			entryIndex,
			physical: hasPhysical ? { action: "skip" } : null,
			nutrition: hasNutrition ? { action: "skip" } : null,
		};
	}
	return promptEdit(entry, entryIndex, hasPhysical, hasNutrition);
}

export async function promptEnrichDecisions(
	enriched: EnrichEntry[],
	opts: { autoAccept?: boolean } = {},
): Promise<EnrichDecision[]> {
	const decisions: EnrichDecision[] = [];
	let autoAcceptRest = opts.autoAccept ?? false;

	for (let i = 0; i < enriched.length; i++) {
		const entry = enriched[i]!;

		if (autoAcceptRest) {
			decisions.push(buildAcceptDecision(entry, i));
			log.step(
				`${chalk.green("✓")} ${entry.name} ${chalk.dim(formatEntrySummary(entry))}`,
			);
			continue;
		}

		const result = await promptEntry(entry, i);

		// A canceled entry gets no decision at all — it (and every entry after
		// it, since we break here) is never visited by `applyEnrichDecisions`,
		// so nothing is written for it, not even category/tags. Without this,
		// Ctrl+C would leave the rest of the batch silently auto-written,
		// contradicting the user's explicit interrupt.
		if (result === "cancel") break;

		if (result === "accept-rest") {
			autoAcceptRest = true;
			decisions.push(buildAcceptDecision(entry, i));
			continue;
		}

		decisions.push(result);
	}

	return decisions;
}
