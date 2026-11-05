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
	/** Minutes before a visit at which its alarm rings. Default 10. */
	alarmMinutes?: number;
	/** The name of the calendar. Default: the title of the work plan. */
	calendarName?: string;
}

/**
 * The work plan as an iCalendar file: one event per visit in the kitchen, in
 * UTC (the calendar shows it in its own zone), with an alarm before it. The
 * title is the recipe and its sections; the description lists what to take
 * out and the programme. Nothing here reads the clock: the stamp is given.
 */
export function buildICS(model: RunSheetModel, options: IcsOptions): string {
	const alarm = options.alarmMinutes ?? 10;
	const lines: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Gram//gram plan//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-CALNAME:${escapeText(options.calendarName ?? model.title)}`,
	];
	model.events.forEach((event, index) => {
		lines.push(
			"BEGIN:VEVENT",
			`UID:${compact(event.start)}-${index + 1}@gram-lang.org`,
			`DTSTAMP:${compact(options.stamp)}`,
			`DTSTART:${compact(event.start)}`,
			`DTEND:${compact(event.end)}`,
			`SUMMARY:${escapeText(event.title)}`,
			`DESCRIPTION:${escapeText(event.description)}`,
			"BEGIN:VALARM",
			"ACTION:DISPLAY",
			`DESCRIPTION:${escapeText(event.title)}`,
			`TRIGGER:-PT${alarm}M`,
			"END:VALARM",
			"END:VEVENT",
		);
	});
	lines.push("END:VCALENDAR");
	return `${lines.map(fold).join("\r\n")}\r\n`;
}
