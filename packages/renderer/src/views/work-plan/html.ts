import { getDictionary } from "@gram-lang/i18n";
import type { RunSheet } from "@gram-lang/scheduler";
import { HTML_ICONS } from "../../shared/icons";
import { escapeHtml } from "../../shared/utils";
import type { RenderableCompilationResult } from "../../types";
import {
	type RunSheetKitLine,
	type RunSheetProgramLine,
	type RunSheetRenderOptions,
	type RunSheetScheduleRow,
	describeRunSheet,
} from "./model";

/**
 * The things of a group as a checklist: the cookware and the other things each
 * in a group of its own, under its own title.
 */
function kitListsHtml(
	items: RunSheetKitLine[],
	e: (value: string) => string,
	titles: { things: string; tools: string },
): string {
	const things = items.filter((l) => l.kind !== "cookware");
	const tools = items.filter((l) => l.kind === "cookware");
	const group = (cls: string, title: string, list: string) =>
		`          <div class="mep-group mep-group-${cls}">\n            <h5 class="mep-sub-title">${e(title)}</h5>\n${list}          </div>\n`;
	let html = "";
	if (tools.length > 0) {
		let list = `          <ul class="kit-list kit-tools">\n`;
		for (const l of tools) {
			// The size follows the name, small; the count sits at the end of the line.
			list += `            <li class="kit-cookware${l.quantity ? " has-qty" : ""}"><label><input type="checkbox"><span>${e(l.name)}${l.note ? ` <span class="kit-detail">(${e(l.note)})</span>` : ""}${l.quantity ? ` <span class="kit-qty">${e(l.quantity)}</span>` : ""}</span></label></li>\n`;
		}
		html += group("tools", titles.tools, `${list}          </ul>\n`);
	}
	if (things.length > 0) {
		let list = `          <ul class="kit-list">\n`;
		for (const l of things) {
			list += `            <li class="kit-${l.kind}"><label><input type="checkbox"><span>${e(l.name)}${l.quantity ? ` <span class="kit-qty">${l.mass ? `<span class="kit-orig">${e(l.quantity)}${l.detail ? ` (${e(l.detail)})` : ""}</span><span class="kit-mass">${e(l.mass)}</span>` : `${e(l.quantity)}${l.detail ? ` (${e(l.detail)})` : ""}`}</span>` : ""}${l.note ? ` <span class="kit-note">${e(l.note)}</span>` : ""}</span></label></li>\n`;
		}
		html += group("ingredients", titles.things, `${list}          </ul>\n`);
	}
	return html;
}

/** "THU 15" as the name of the day and its number, to set the number apart. */
function dayParts(label: string): { name: string; number?: string } {
	const m = /^(.*\S)\s+(\d{1,2})$/.exec(label);
	return m ? { name: m[1]!, number: m[2]! } : { name: label };
}

/** The work plan as an HTML fragment, every word of the recipe escaped. */
export function runSheetToHTML(
	sheet: RunSheet,
	data: RenderableCompilationResult,
	options: RunSheetRenderOptions = {},
): string {
	const t = getDictionary(options.lang).renderer;
	const model = describeRunSheet(sheet, data, options);
	const e = escapeHtml;
	let html = `<section class="gram-run-sheet">\n  <header class="work-plan-header">\n    <h2>${e(model.title)}</h2>\n`;
	if (model.subtitle) {
		html += `    <p class="work-plan-subtitle">${e(model.subtitle)}</p>\n`;
	}
	html += `    <p class="work-plan-summary">${e(model.summary)}</p>\n`;
	if (model.problems.length > 0) {
		html += `    <section class="run-sheet-problems work-plan-problems" role="alert">\n      <h3><span class="problem-icon" aria-hidden="true">${HTML_ICONS.warning}</span> <span>${e(t.runSheetProblems)}</span></h3>\n      <ul>\n`;
		for (const p of model.problems) html += `        <li>${e(p)}</li>\n`;
		html += `      </ul>\n    </section>\n`;
	}
	if (model.schedule.length > 0) {
		// The days at a glance: the rows of a day under its name.
		const groups: RunSheetScheduleRow[][] = [];
		for (const row of model.schedule) {
			if (row.day || groups.length === 0) groups.push([]);
			groups.at(-1)!.push(row);
		}
		html += `    <ol class="work-plan-schedule">\n`;
		for (const rows of groups) {
			const day = rows[0]?.day;
			html += `      <li class="schedule-group">\n        <div class="schedule-day">`;
			if (day) {
				const { name, number } = dayParts(day);
				html += `${e(name)}${number ? `<small>${e(number)}</small>` : ""}`;
			}
			html += `</div>\n        <div class="schedule-rows">\n`;
			for (const row of rows) {
				if (row.kind === "thread") {
					html += `          <div class="schedule-row schedule-thread"><span class="schedule-line"></span><span class="schedule-text">${e(row.text)}</span></div>\n`;
				} else {
					html += `          <div class="schedule-row schedule-${row.kind}"><span class="schedule-time">${e(row.time ?? "")}</span><span class="schedule-text">${e(row.text)}</span></div>\n`;
				}
			}
			html += `        </div>\n      </li>\n`;
		}
		html += `    </ol>\n`;
		html += `    <p class="work-plan-legend"><span class="legend-cook">${e(t.workPlanLegendCook)}</span><span class="legend-thread">${e(t.workPlanLegendThread)}</span></p>\n`;
	}
	html += `  </header>\n`;
	for (const day of model.days) {
		html += `  <section class="work-plan-day">\n    <h3><span class="day-heading">${e(day.heading)}</span> <span class="day-slot">${e(day.slot)}</span></h3>\n`;
		for (const n of day.notices) {
			html += `    <p class="work-plan-notice">${e(n)}</p>\n`;
		}
		for (const p of day.visits) {
			html += `    <div class="work-plan-visit">\n`;
			if (day.visits.length > 1) {
				html += `      <h4 class="work-plan-visit-slot">${e(p.slot)}</h4>\n`;
			}
			if (p.margin) {
				html += `      <p class="work-plan-margin">${e(p.margin)}</p>\n`;
			}
			const titles = { things: t.workPlanIngredients, tools: t.cookware };
			const pill = (l: RunSheetProgramLine) =>
				l.startTime
					? `<span class="sec-time-pill">${e(t.workPlanStart).replace("{time}", `<strong>${e(l.startTime)}</strong>`)}</span>`
					: "";
			const title = (l: RunSheetProgramLine) =>
				`<span class="sec-title">${e(l.section)}${l.continued ? ` <span class="sec-cont">(${e(t.workPlanContinued)})</span>` : ""}</span>${l.origin ? `<span class="sec-origin">${e(l.origin)}</span>` : ""}`;
			const steps = (l: RunSheetProgramLine) =>
				`<ol class="exec-steps-list">\n${l.steps
					.map((x) =>
						x.comment
							? `            <li class="step-comment">${x.html}</li>\n`
							: `            <li value="${x.number}">${x.action ? `<span class="step-action-badge">${e(x.action)}</span> ` : ""}<span class="step-content">${x.html}</span></li>\n`,
					)
					.join("")}          </ol>\n`;
			const sub = (n: number, label: string, body: string, cls: string) =>
				`        <div class="station-sub-block ${cls}">\n          <h5 class="step-123-sub-title"><span class="badge-num-sm">${n}</span> ${e(label)}</h5>\n${body}        </div>\n`;
			const box = (n: number, label: string, cls: string, body: string) =>
				`      <div class="box-123 ${cls}">\n        <h4 class="step-123-title"><span class="badge-num">${n}</span> ${e(label)}</h4>\n${body}      </div>\n`;
			let leavingNumber = 3;
			if (model.miseEnPlace === "perSection") {
				// A station per section: what to take out, then what to do.
				for (const group of p.kit) {
					html += `      <div class="section-station-card station-mep-only">\n        <div class="station-header"><span class="sec-title">${e(group.section ?? "")}</span></div>\n`;
					html += sub(
						1,
						t.miseEnPlace,
						kitListsHtml(group.items, e, titles),
						"station-mep",
					);
					html += `      </div>\n`;
				}
				for (const l of p.program) {
					let n = 0;
					html += `      <div class="section-station-card">\n        <div class="station-header">${title(l)}${pill(l)}</div>\n`;
					if (l.kit?.length) {
						html += sub(
							++n,
							t.miseEnPlace,
							kitListsHtml(l.kit, e, titles),
							"station-mep",
						);
					}
					html += sub(
						++n,
						t.workPlanExecution,
						`          ${steps(l)}`,
						"station-exec",
					);
					html += `      </div>\n`;
				}
			} else {
				let n = 0;
				if (p.kit.length > 0) {
					let body = "";
					for (const group of p.kit) {
						body += `        <div class="kit-group">\n`;
						if (group.section) {
							body += `          <h5 class="kit-section-title">${e(group.section)}</h5>\n`;
						}
						body += kitListsHtml(group.items, e, titles);
						body += `        </div>\n`;
					}
					html += box(++n, t.miseEnPlace, "box-step-1", body);
				}
				if (p.program.length > 0) {
					let body = "";
					for (const l of p.program) {
						body += `        <div class="section-exec-card">\n          <div class="section-exec-header">${title(l)}${pill(l)}</div>\n          ${steps(l)}        </div>\n`;
					}
					html += box(++n, t.workPlanExecution, "box-step-2", body);
				}
				leavingNumber = ++n;
			}
			let leaving = "";
			if (p.waits.length > 0) {
				leaving += `        <ul>\n`;
				for (const w of p.waits) {
					leaving += `          <li><span class="wait-name">${e(w.name)}${w.until ? ` <span class="wait-until">${e(w.until)}</span>` : ""}</span><span class="wait-length">${e(w.length)}</span></li>\n`;
				}
				leaving += `        </ul>\n`;
			}
			if (p.next !== undefined) {
				leaving += `        <p class="leaving-next">${e(p.next)}</p>\n`;
			}
			html += box(
				leavingNumber,
				t.workPlanLeaving,
				"box-step-3 work-plan-leaving",
				leaving,
			);
			html += `    </div>\n`;
		}
		html += `  </section>\n`;
	}
	return `${html}</section>\n`;
}
