import { WEEKDAYS, type Weekday } from "@gram-lang/scheduler";

/** The hours of one day of the week, when it has its own. */
export interface DayAvailability {
	enabled: boolean;
	from: string;
	to: string;
}

/** The plan the cook gives: when it is served, where, and when they are in the kitchen. */
export interface PlanSettings {
	serveAt: string;
	timeZone: string;
	from: string;
	to: string;
	customWeekdays?: boolean;
	weekdays?: Partial<Record<Weekday, DayAvailability>>;
}

const DEFAULT_FROM = "08:00";
const DEFAULT_TO = "22:00";

/** The plan with one of its text fields changed. */
export function withPlanField(
	plan: PlanSettings,
	field: keyof PlanSettings,
	value: string,
): PlanSettings {
	return { ...plan, [field]: value };
}

/** Whether the cook is in the kitchen on this day: every day, until it says otherwise. */
export function dayEnabled(plan: PlanSettings | undefined, day: Weekday) {
	if (!plan?.weekdays) return true;
	return plan.weekdays[day]?.enabled ?? true;
}

/** When the cook arrives on this day: its own hour, else the daily one. */
export function dayFrom(plan: PlanSettings | undefined, day: Weekday): string {
	return plan?.weekdays?.[day]?.from ?? plan?.from ?? DEFAULT_FROM;
}

/** When the cook leaves on this day: its own hour, else the daily one. */
export function dayTo(plan: PlanSettings | undefined, day: Weekday): string {
	return plan?.weekdays?.[day]?.to ?? plan?.to ?? DEFAULT_TO;
}

/**
 * The plan with the hours by day switched on or off. Switching them on for the
 * first time gives every day the daily hours to start from.
 */
export function withCustomWeekdays(
	plan: PlanSettings,
	checked: boolean,
): PlanSettings {
	if (checked && !plan.weekdays) {
		const weekdays: Partial<Record<Weekday, DayAvailability>> = {};
		for (const day of WEEKDAYS) {
			weekdays[day] = {
				enabled: true,
				from: plan.from || DEFAULT_FROM,
				to: plan.to || DEFAULT_TO,
			};
		}
		return { ...plan, customWeekdays: true, weekdays };
	}
	return { ...plan, customWeekdays: checked };
}

/** The plan with one day opened if it was closed, closed if it was open (its hours kept). */
export function withDayToggled(plan: PlanSettings, day: Weekday): PlanSettings {
	return {
		...plan,
		weekdays: {
			...(plan.weekdays ?? {}),
			[day]: {
				enabled: !dayEnabled(plan, day),
				from: dayFrom(plan, day),
				to: dayTo(plan, day),
			},
		},
	};
}

/** The plan with the arrival or the departure of one day changed. */
export function withDayTime(
	plan: PlanSettings,
	day: Weekday,
	field: "from" | "to",
	value: string,
): PlanSettings {
	const current = plan.weekdays?.[day] ?? {
		enabled: true,
		from: plan.from || DEFAULT_FROM,
		to: plan.to || DEFAULT_TO,
	};
	return {
		...plan,
		weekdays: {
			...(plan.weekdays ?? {}),
			[day]: { ...current, [field]: value },
		},
	};
}

/** Every time zone the browser knows, or none if it cannot say. */
export function supportedTimeZones(): string[] {
	try {
		return (
			(
				Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
			).supportedValuesOf?.("timeZone") ?? []
		);
	} catch {
		return [];
	}
}

/** The time zone of the browser. */
export function localTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}

/**
 * The time zones to choose from: the browser's own first, then UTC, then the
 * rest, and the one already chosen even if the browser does not list it.
 */
export function timeZoneChoices(
	chosen: string | undefined,
	supported: string[] = supportedTimeZones(),
	local: string = localTimeZone(),
): string[] {
	const list = supported.length > 0 ? supported : [local, "UTC"];
	const set = new Set<string>();
	set.add(local);
	if (local !== "UTC") set.add("UTC");
	for (const zone of list) set.add(zone);
	if (chosen) set.add(chosen);
	return Array.from(set);
}

/**
 * The name of each day of the week, in the page's language, from `Intl`:
 * 2024-01-01 was a Monday, so the n-th day of `WEEKDAYS` falls on the n-th of
 * January 2024. Capitalized, as it heads a row.
 */
export function weekdayNames(lang: string): Record<Weekday, string> {
	const format = new Intl.DateTimeFormat(lang, {
		weekday: "long",
		timeZone: "UTC",
	});
	return Object.fromEntries(
		WEEKDAYS.map((day, i) => {
			const name = format.format(Date.UTC(2024, 0, 1 + i));
			return [day, name.charAt(0).toLocaleUpperCase(lang) + name.slice(1)];
		}),
	) as Record<Weekday, string>;
}

/**
 * "Sun 11 Oct, 13:00": a local serving time ("2026-10-11T13:00"), in the
 * page's language. Read as UTC and written in UTC, so the browser's own zone
 * never moves it; the raw value when it can't be read.
 */
export function serveAtLabel(serveAt: string, lang: string): string {
	const instant = new Date(`${serveAt}:00Z`);
	if (Number.isNaN(instant.getTime())) return serveAt;
	return new Intl.DateTimeFormat(lang, {
		timeZone: "UTC",
		weekday: "short",
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(instant);
}
