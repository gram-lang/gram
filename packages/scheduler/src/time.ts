/*
 * Calendar arithmetic for the projection, with no date library and no
 * dependency on the machine's time zone: instants are whole or fractional
 * minutes since the Unix epoch (UTC), and local time is only ever read with
 * `Intl.DateTimeFormat` and an explicit IANA `timeZone`.
 */

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1440;

export const WEEKDAYS = [
	"mon",
	"tue",
	"wed",
	"thu",
	"fri",
	"sat",
	"sun",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface LocalTime {
	/** "2026-10-11" */
	date: string;
	/** Minutes since local midnight, 0 to 1439. */
	minuteOfDay: number;
	weekday: Weekday;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Throws a `RangeError` naming the zone when it is not a valid IANA zone. */
function formatterFor(timeZone: string): Intl.DateTimeFormat {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		try {
			formatter = new Intl.DateTimeFormat("en-US", {
				timeZone,
				hourCycle: "h23",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				weekday: "short",
			});
		} catch {
			throw new RangeError(`Unknown time zone "${timeZone}"`);
		}
		formatters.set(timeZone, formatter);
	}
	return formatter;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

interface Parts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	weekday: Weekday;
}

function partsOf(utcMinutes: number, timeZone: string): Parts {
	const found: Record<string, string> = {};
	for (const part of formatterFor(timeZone).formatToParts(
		new Date(Math.floor(utcMinutes) * MS_PER_MINUTE),
	)) {
		found[part.type] = part.value;
	}
	return {
		year: Number(found.year),
		month: Number(found.month),
		day: Number(found.day),
		hour: Number(found.hour),
		minute: Number(found.minute),
		weekday: found.weekday!.slice(0, 3).toLowerCase() as Weekday,
	};
}

/** The local date, time of day and weekday at an instant. */
export function toLocal(utcMinutes: number, timeZone: string): LocalTime {
	const p = partsOf(utcMinutes, timeZone);
	return {
		date: `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`,
		minuteOfDay: p.hour * 60 + p.minute,
		weekday: p.weekday,
	};
}

/** "2026-10-11T13:00", the local time at an instant. */
export function toLocalIso(utcMinutes: number, timeZone: string): string {
	const local = toLocal(utcMinutes, timeZone);
	return `${local.date}T${pad(Math.floor(local.minuteOfDay / 60))}:${pad(local.minuteOfDay % 60)}`;
}

/** "2026-10-11T11:00:00Z", an instant. */
export function toUtcIso(utcMinutes: number): string {
	return new Date(Math.round(utcMinutes) * MS_PER_MINUTE)
		.toISOString()
		.replace(".000Z", "Z");
}

const LOCAL_ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Minutes since the epoch of a local wall-clock reading read as if it were UTC. */
function wallClockMinutes(
	year: number,
	month: number,
	day: number,
	minuteOfDay: number,
): number {
	return Date.UTC(year, month - 1, day) / MS_PER_MINUTE + minuteOfDay;
}

/** Offset of the zone from UTC at an instant, in minutes. */
function offsetAt(utcMinutes: number, timeZone: string): number {
	const p = partsOf(utcMinutes, timeZone);
	const local = wallClockMinutes(
		p.year,
		p.month,
		p.day,
		p.hour * 60 + p.minute,
	);
	return local - Math.floor(utcMinutes);
}

/**
 * The instant of a local wall-clock reading. A time skipped by the clocks
 * going forward becomes the next valid one (02:30 that does not exist reads as
 * 03:30); a time that happens twice, when they go back, is the first one.
 */
function localToUtc(
	year: number,
	month: number,
	day: number,
	minuteOfDay: number,
	timeZone: string,
): number {
	const wall = wallClockMinutes(year, month, day, minuteOfDay);
	const before = offsetAt(wall - MINUTES_PER_DAY, timeZone);
	const after = offsetAt(wall + MINUTES_PER_DAY, timeZone);
	const candidates = [wall - before, wall - after].filter(
		(instant) => offsetAt(instant, timeZone) === wall - instant,
	);
	// No candidate: the reading falls in the gap. The offset in force before it
	// puts it just after the gap.
	return candidates.length > 0 ? Math.min(...candidates) : wall - before;
}

/** Parses "2026-10-11T13:00" (a space also works) as a local time in the zone. */
export function parseLocalIso(value: string, timeZone: string): number {
	const m = LOCAL_ISO.exec(value);
	if (!m) {
		throw new RangeError(
			`Expected a local date-time like "2026-10-11T13:00", got "${value}"`,
		);
	}
	const [year, month, day, hour, minute] = m.slice(1).map(Number) as [
		number,
		number,
		number,
		number,
		number,
	];
	if (
		hour > 23 ||
		minute > 59 ||
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > 31
	) {
		throw new RangeError(`"${value}" is not a valid date-time`);
	}
	return localToUtc(year, month, day, hour * 60 + minute, timeZone);
}

/**
 * Parses an instant: an ISO date-time with `Z` or an offset, or, without
 * either, a local time in the zone.
 */
export function parseInstant(value: string, timeZone: string): number {
	if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
		const ms = Date.parse(value);
		if (Number.isNaN(ms))
			throw new RangeError(`"${value}" is not a valid instant`);
		return ms / MS_PER_MINUTE;
	}
	return parseLocalIso(value, timeZone);
}

/** The instant of a local time of day ("08:00", or minutes) on a local date. */
export function localDateTime(
	date: string,
	minuteOfDay: number,
	timeZone: string,
): number {
	const m = DATE_ONLY.exec(date);
	if (!m) throw new RangeError(`"${date}" is not a valid date`);
	const [year, month, day] = m.slice(1).map(Number) as [number, number, number];
	return localToUtc(year, month, day, minuteOfDay, timeZone);
}

/** The local date `days` after `date` (negative: before), as "YYYY-MM-DD". */
export function addDays(date: string, days: number): string {
	const m = DATE_ONLY.exec(date);
	if (!m) throw new RangeError(`"${date}" is not a valid date`);
	const [year, month, day] = m.slice(1).map(Number) as [number, number, number];
	const shifted = new Date(Date.UTC(year, month - 1, day + days));
	return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Whole local days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
	const a = DATE_ONLY.exec(from);
	const b = DATE_ONLY.exec(to);
	if (!a || !b)
		throw new RangeError(`"${from}" or "${to}" is not a valid date`);
	const ms = (m: RegExpExecArray) =>
		Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return Math.round((ms(b) - ms(a)) / (MINUTES_PER_DAY * MS_PER_MINUTE));
}

/** "08:00" to minutes since midnight. */
export function parseClock(value: string): number {
	const m = /^(\d{1,2}):(\d{2})$/.exec(value);
	if (!m) throw new RangeError(`Expected a time like "08:00", got "${value}"`);
	const minutes = Number(m[1]) * 60 + Number(m[2]);
	if (Number(m[1]) > 24 || Number(m[2]) > 59 || minutes > 1440) {
		throw new RangeError(`"${value}" is not a valid time of day`);
	}
	return minutes;
}
