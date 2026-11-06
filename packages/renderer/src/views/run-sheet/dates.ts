/*
 * The days of the run sheet, named in the reader's language. Every date here
 * is already local ("2026-10-11", or a local date-time whose first ten
 * characters are the date): it is named in UTC at midday, so no zone, the
 * reader's or the runtime's, ever moves it to another day.
 */

/** Midday UTC of the "YYYY-MM-DD" a date or local date-time starts with. */
const noonOf = (date: string) =>
	Date.UTC(
		Number(date.slice(0, 4)),
		Number(date.slice(5, 7)) - 1,
		Number(date.slice(8, 10)),
		12,
	);

const dateFormat = (
	date: string,
	lang: string | undefined,
	options: Intl.DateTimeFormatOptions,
) =>
	new Intl.DateTimeFormat(lang || "en", { timeZone: "UTC", ...options }).format(
		noonOf(date),
	);

/** "Sunday, October 11". */
export const longDate = (date: string, lang?: string) =>
	dateFormat(date, lang, { weekday: "long", day: "numeric", month: "long" });

/** "Sunday". */
export const weekdayName = (date: string, lang?: string) =>
	dateFormat(date, lang, { weekday: "long" });

/** "Sun". */
export const shortDay = (date: string, lang?: string) =>
	dateFormat(date, lang, { weekday: "short" });
