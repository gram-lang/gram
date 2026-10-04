import type { RunSheetModel } from "@gram-lang/renderer";

const encoder = new TextEncoder();

/** Escapes a text value the way RFC 5545 asks: backslash, semicolon, comma, newline. */
const escapeText = (text: string) =>
	text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, ";")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");

/** Folds a line at 75 octets, never inside a character; a continuation starts with a space. */
function fold(line: string): string {
	if (encoder.encode(line).length <= 75) return line;
	const parts: string[] = [];
	let current = "";
	let size = 0;
	for (const char of line) {
		const width = encoder.encode(char).length;
		const limit = parts.length === 0 ? 75 : 74;
		if (size + width > limit) {
			parts.push(current);
			current = "";
			size = 0;
		}
		current += char;
		size += width;
	}
	parts.push(current);
	return parts.join("\r\n ");
}

/** "2026-10-10T19:38:00Z" as "20261010T193800Z". */
const compact = (iso: string) => iso.replace(/[-:]/g, "");

export interface IcsOptions {
	/** DTSTAMP of every event, an ISO instant in UTC. */
	stamp: string;
	/** Minutes before an active task at which its alarm rings. Default 5. */
	alarmMinutes?: number;
	/** Words for the alarm text of a task that is not named in a way a reminder can use. */
	calendarName?: string;
}

/**
 * The production sheet as an iCalendar file: one event per task, in UTC (the
 * calendar shows it in its own zone), and an alarm on the tasks that need the
 * cook's hands. Nothing here reads the clock: the stamp is given.
 */
export function buildICS(model: RunSheetModel, options: IcsOptions): string {
	const alarm = options.alarmMinutes ?? 5;
	const lines: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Gram//gram plan//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-CALNAME:${escapeText(options.calendarName ?? model.title)}`,
	];
	const seen = new Map<string, number>();
	for (const day of model.days) {
		for (const line of day.lines) {
			// A merged mise en place keeps the id of its first task: two events can share one.
			const n = (seen.get(line.task) ?? 0) + 1;
			seen.set(line.task, n);
			const description = [line.detail, line.length, line.note]
				.filter(Boolean)
				.join("\n");
			lines.push(
				"BEGIN:VEVENT",
				`UID:${compact(line.start)}-${line.task}${n > 1 ? `-${n}` : ""}@gram-lang.org`,
				`DTSTAMP:${compact(options.stamp)}`,
				`DTSTART:${compact(line.start)}`,
				`DTEND:${compact(line.end)}`,
				`SUMMARY:${escapeText(line.title)}`,
				`DESCRIPTION:${escapeText(description)}`,
			);
			if (line.active) {
				lines.push(
					"BEGIN:VALARM",
					"ACTION:DISPLAY",
					`DESCRIPTION:${escapeText(line.title)}`,
					`TRIGGER:-PT${alarm}M`,
					"END:VALARM",
				);
			}
			lines.push("END:VEVENT");
		}
	}
	lines.push("END:VCALENDAR");
	return `${lines.map(fold).join("\r\n")}\r\n`;
}
