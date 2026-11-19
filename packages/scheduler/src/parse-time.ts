import { isCalendarDate } from "./time";

export interface TimeOfDayOptions {
	/**
	 * The time ends a range: midnight may then be its end, "24:00", written
	 * that way or "12am". Off, "24:00" is refused and "12am" is "00:00".
	 */
	end?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

const H24 = /^(?<hour>\d{1,2}):(?<minute>\d{2})$/;
// "8am", "8 am", "8:30pm", "8:30 P.M.": a suffix, the minutes optional. `\s`
// takes the narrow no-break space `Intl` puts before "PM", so a time copied
// from a run sheet reads back.
const H12 =
	/^(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<half>[ap])\.?\s*m\.?$/i;

/**
 * A time of day written in 24 hours ("13:00", "9:30") or in 12 hours with
 * am/pm ("1pm", "1:00 PM", "8:30 am"), as "HH:MM". `null` when it is
 * neither. "12am" is midnight, "12pm" noon; with `end`, "12am" and "24:00"
 * are the midnight that ends the day, "24:00". An hour alone ("8") is
 * refused: without minutes or a suffix, it could be anything.
 *
 * The one reading of a time of day for every flag and setting that takes
 * one: data, never words.
 */
export function parseTimeOfDay(
	text: string,
	options: TimeOfDayOptions = {},
): string | null {
	const value = text.trim();
	const h24 = H24.exec(value)?.groups;
	if (h24) {
		const hour = Number(h24.hour);
		const minute = Number(h24.minute);
		if (minute > 59) return null;
		if (hour === 24 && minute === 0 && options.end) return "24:00";
		return hour > 23 ? null : `${pad(hour)}:${pad(minute)}`;
	}
	const h12 = H12.exec(value)?.groups;
	if (!h12) return null;
	const hour = Number(h12.hour);
	const minute = Number(h12.minute ?? "0");
	if (hour < 1 || hour > 12 || minute > 59) return null;
	const pm = h12.half!.toLowerCase() === "p";
	if (!pm && hour === 12 && minute === 0 && options.end) return "24:00";
	return `${pad((hour % 12) + (pm ? 12 : 0))}:${pad(minute)}`;
}

/**
 * Why a local date-time was refused: its `date` is not a day of the
 * calendar ("2026-02-30"), or it is not shaped like a date and a time at all
 * (`format`, the time included).
 */
export type LocalDateTimeParse =
	| { ok: true; local: string }
	| { ok: false; reason: "date" | "format"; date?: string };

const LOCAL = /^(?<date>\d{4}-\d{2}-\d{2})(?:T|\s+)(?<time>.+)$/;

/**
 * A local date and a time of day: "2026-10-11 13:00", "2026-10-11T9:30",
 * "2026-10-11 1:00 pm", as "2026-10-11T13:00". The syntax of `--serve`, of
 * the bounds of `--find` and of the editor's serving time.
 */
export function parseLocalDateTime(text: string): LocalDateTimeParse {
	const m = LOCAL.exec(text.trim())?.groups;
	if (!m) return { ok: false, reason: "format" };
	if (!isCalendarDate(m.date!)) {
		return { ok: false, reason: "date", date: m.date! };
	}
	const time = parseTimeOfDay(m.time!);
	return time === null
		? { ok: false, reason: "format" }
		: { ok: true, local: `${m.date}T${time}` };
}
