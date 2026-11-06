import { fillTemplate, getDictionary } from "@gram-lang/i18n";
import type { RunSheet } from "@gram-lang/scheduler";
import { escapeMarkdownHtml } from "../../shared/utils";
import type { RenderableCompilationResult } from "../../types";
import { kitLines, sectionHeading } from "./lines";
import {
	type RunSheetKitLine,
	type RunSheetProgramLine,
	type RunSheetRenderOptions,
	type RunSheetStepLine,
	describeRunSheet,
} from "./model";

/** The run sheet as Markdown: a heading per day, a checklist to take out. */
export function runSheetToMarkdown(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const md = escapeMarkdownHtml;
	const model = describeRunSheet(sheet, data, options);
	const sectionHead = sectionHeading(t);
	const startOf = (l: RunSheetProgramLine) =>
		l.startTime ? fillTemplate(t.runSheetStart, { time: l.startTime }) : "";
	const h1 = "#";
	const h2 = "##";
	const h3 = "###";
	const out: string[] = [`${h1} ${md(model.title)}`, ""];
	if (model.subtitle) out.push(md(model.subtitle), "");
	out.push(md(model.summary), "");
	if (model.problems.length > 0) {
		out.push(`> **${md(t.runSheetProblems)}**`);
		for (const p of model.problems) out.push(`> - ⚠️ ${md(p)}`);
		out.push("");
	}
	for (const row of model.schedule) {
		if (row.kind === "thread") {
			out.push(`  - *${md(row.text)}*`);
			continue;
		}
		const lead = [row.day, row.time].filter(Boolean).map(md).join(" · ");
		out.push(
			`- ${lead ? `**${lead}** ` : ""}${row.kind === "serve" ? "★ " : ""}${md(row.text)}`,
		);
	}
	out.push("");
	for (const day of model.days) {
		out.push(`${h2} ${md(day.heading)} · ${md(day.slot)}`, "");
		for (const n of day.notices) out.push(`> ⚠️ ${md(n)}`, "");
		for (const p of day.visits) {
			const many = day.visits.length > 1;
			if (many) out.push(`${h3} ${md(p.slot)}`, "");
			if (p.margin) out.push(md(p.margin), "");
			// The parts sit one level under the slot when there are several visits.
			const part = many ? `${h3}#` : h3;
			const item = (l: RunSheetKitLine) =>
				`- [ ] ${md(l.text)}${l.detail ? ` (${md(l.detail)})` : ""}`;
			const stepLines = (steps: RunSheetStepLine[]) =>
				steps.flatMap((x) =>
					x.comment
						? [`> *${x.md}*`, ""]
						: [
								`${x.number}. ${x.action ? `**[${md(x.action)}]** ` : ""}${x.md}`,
							],
				);
			const startPart = (l: RunSheetProgramLine) =>
				`${l.origin ? ` · ${md(l.origin)}` : ""}${startOf(l) ? ` · ${md(startOf(l))}` : ""}`;
			let n = 0;
			if (model.miseEnPlace === "perSection") {
				for (const group of p.kit) {
					out.push(`${part} ${md(group.section ?? "")}`, "");
					out.push(`**${md(t.miseEnPlace)}**`, "");
					out.push(...group.items.map(item), "");
				}
				for (const l of p.program) {
					out.push(`${part} ${md(sectionHead(l))}${startPart(l)}`, "");
					if (l.kit?.length) {
						out.push(`**${md(t.miseEnPlace)}**`, "", ...l.kit.map(item), "");
					}
					out.push(`**${md(t.runSheetExecution)}**`, "");
					out.push(...stepLines(l.steps), "");
				}
				out.push(`${part} ${md(t.runSheetLeaving)}`, "");
			} else {
				if (p.kit.length > 0) {
					out.push(`${part} ${++n}. ${md(t.miseEnPlace)}`, "");
					out.push(
						...kitLines(p.kit, {
							title: (section) => `*${md(section)}*`,
							item,
							gap: "",
						}),
						"",
					);
				}
				if (p.program.length > 0) {
					out.push(`${part} ${++n}. ${md(t.runSheetExecution)}`, "");
					for (const l of p.program) {
						out.push(`**${md(sectionHead(l))}**${startPart(l)}`, "");
						out.push(...stepLines(l.steps), "");
					}
				}
				out.push(`${part} ${++n}. ${md(t.runSheetLeaving)}`, "");
			}
			const waits = p.next === undefined ? p.leaving : p.leaving.slice(0, -1);
			for (const l of waits) out.push(`- ${md(l)}`);
			if (waits.length > 0) out.push("");
			if (p.next !== undefined) out.push(md(p.next), "");
		}
	}
	return `${out.join("\n").trimEnd()}\n`;
}
