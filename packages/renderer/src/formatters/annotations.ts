import { getDictionary } from "@gram-lang/i18n";
import type { RecipeAnnotations, StepNote } from "../run-sheet";
import { escapeHtml, escapeMarkdownHtml } from "../utils";

/*
 * The markup of a recipe on the calendar, one function per piece and per
 * format. The words come from `annotateRecipe` (run-sheet.ts), already
 * translated and rounded: nothing here decides what to say, only how a format
 * writes it, and everything from the recipe is escaped.
 */

/** At the top of the instructions: when it is served, and what could not be fixed. */
export function summaryHTML(
	annotations: RecipeAnnotations,
	lang: string | undefined,
): string {
	const t = getDictionary(lang).renderer;
	let html = `<aside class="plan-summary">\n  <p class="plan-served">${escapeHtml(annotations.servedAt)}</p>\n`;
	if (annotations.problems.length > 0) {
		html += `  <p class="plan-problems-title"><strong>${escapeHtml(t.runSheetProblems)}</strong></p>\n  <ul class="plan-problems">\n`;
		for (const problem of annotations.problems) {
			html += `    <li>${escapeHtml(problem)}</li>\n`;
		}
		html += `  </ul>\n`;
	}
	return `${html}</aside>\n`;
}

/** The day, between two steps of a list, when a step falls on another date than the one before. */
export const dayHTML = (note: StepNote): string =>
	note.day ? `<li class="step-day">${escapeHtml(note.day)}</li>\n` : "";

/** Inside a step: when it starts, then each rest it leaves. */
export function stepHTML(note: StepNote): string {
	let html = `<p class="step-plan"><span class="step-when">${escapeHtml(note.when)}</span>`;
	for (const rest of note.rests) {
		html += `<br><span class="step-rest">${escapeHtml(rest.text)}</span>`;
		if (rest.note)
			html += ` <em class="step-note">${escapeHtml(rest.note)}</em>`;
	}
	return `${html}</p>`;
}

export function summaryMarkdown(
	annotations: RecipeAnnotations,
	lang: string | undefined,
): string {
	const t = getDictionary(lang).renderer;
	let md = `> **${escapeMarkdownHtml(annotations.servedAt)}**\n`;
	if (annotations.problems.length > 0) {
		md += `>\n> ${escapeMarkdownHtml(t.runSheetProblems)}:\n`;
		for (const problem of annotations.problems) {
			md += `> - ${escapeMarkdownHtml(problem)}\n`;
		}
	}
	return `${md}\n`;
}

export const dayMarkdown = (note: StepNote): string =>
	note.day ? `**${escapeMarkdownHtml(note.day)}**\n\n` : "";

/** What follows a step's line: its time, as a suffix, and its rests, as sub-items. */
export const whenMarkdown = (note: StepNote): string =>
	` — *${escapeMarkdownHtml(note.when)}*`;

export function restsMarkdown(note: StepNote): string {
	let md = "";
	for (const rest of note.rests) {
		md += `   - ⏳ ${escapeMarkdownHtml(rest.text)}\n`;
		if (rest.note) md += `   - ⚠️ *${escapeMarkdownHtml(rest.note)}*\n`;
	}
	return md;
}
