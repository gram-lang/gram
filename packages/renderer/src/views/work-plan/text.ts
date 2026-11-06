import { getDictionary } from "@gram-lang/i18n";
import type { RunSheet } from "@gram-lang/scheduler";
import type { RenderableCompilationResult } from "../../types";
import { kitLines, sectionHeading } from "./lines";
import {
	type RunSheetKitLine,
	type RunSheetProgramLine,
	type RunSheetRenderOptions,
	type RunSheetStepLine,
	describeRunSheet,
	fill,
} from "./model";

/** The work plan as plain text. */
export function runSheetToText(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const model = describeRunSheet(sheet, data, options);
	const upper = (value: string) =>
		value.toLocaleUpperCase(options.lang || "en");
	const sectionHead = sectionHeading(t);
	const startOf = (l: RunSheetProgramLine) =>
		l.startTime ? fill(t.workPlanStart, { time: l.startTime }) : "";
	const out: string[] = [model.title];
	if (model.subtitle) out.push(model.subtitle);
	out.push(model.summary, "");
	if (model.problems.length > 0) {
		out.push(t.runSheetProblems);
		for (const p of model.problems) out.push(`  ! ${p}`);
		out.push("");
	}
	for (const row of model.schedule) {
		const lead = (row.day ?? "").padEnd(9);
		if (row.kind === "thread") {
			out.push(`${" ".repeat(9)}┆ ${row.text}`);
		} else {
			const mark = row.kind === "serve" ? "★" : "▮";
			out.push(
				`${lead}${mark} ${(row.time ?? "").padEnd(14)}${row.text}`.trimEnd(),
			);
		}
	}
	if (model.schedule.length > 0) {
		out.push("", `▮ ${t.workPlanLegendCook}   ┆ ${t.workPlanLegendThread}`);
	}
	for (const day of model.days) {
		out.push("", `${day.heading.toUpperCase()}  ${day.slot}`);
		for (const n of day.notices) out.push(`  ! ${n}`);
		for (const p of day.visits) {
			if (day.visits.length > 1) out.push("", `  ${p.slot}`);
			if (p.margin) out.push(`  ${p.margin}`);
			const item = (indent: string) => (l: RunSheetKitLine) =>
				`${indent}[ ] ${l.text}${l.detail ? ` (${l.detail})` : ""}`;
			const stepLines = (steps: RunSheetStepLine[], indent: string) =>
				steps.map((x) =>
					x.comment
						? `${indent}  (${x.text})`
						: `${indent}${x.number}. ${x.action ? `[${x.action}] ` : ""}${x.text}`,
				);
			const headOf = (l: RunSheetProgramLine) =>
				`${upper(sectionHead(l))}${l.origin ? ` — ${l.origin}` : ""}${startOf(l) ? ` (${startOf(l)})` : ""}`;
			if (model.miseEnPlace === "perSection") {
				// Each section is a station: what to take out, then what to do.
				for (const group of p.kit) {
					out.push(`  ${upper(group.section ?? "")}`);
					out.push(`    ${t.miseEnPlace}`);
					out.push(...group.items.map(item("      ")));
				}
				for (const l of p.program) {
					out.push(`  ${headOf(l)}`);
					if (l.kit?.length) {
						out.push(`    ${t.miseEnPlace}`);
						out.push(...l.kit.map(item("      ")));
					}
					out.push(`    ${t.workPlanExecution}`);
					out.push(...stepLines(l.steps, "      "));
				}
			} else {
				if (p.kit.length > 0) {
					out.push(`  ${upper(t.miseEnPlace)}`);
					out.push(
						...kitLines(p.kit, {
							title: (section) => `    ${section} :`,
							item: item("    "),
						}),
					);
				}
				if (p.program.length > 0) {
					out.push(`  ${upper(t.workPlanExecution)}`);
					for (const l of p.program) {
						out.push(`    ${headOf(l)}`);
						out.push(...stepLines(l.steps, "      "));
					}
				}
			}
			out.push(`  ${upper(t.workPlanLeaving)}`);
			for (const l of p.next === undefined
				? p.leaving
				: p.leaving.slice(0, -1)) {
				out.push(`    ${l}`);
			}
			if (p.next !== undefined) out.push(`  ${p.next}`);
		}
	}
	return `${out.join("\n").trimEnd()}\n`;
}
