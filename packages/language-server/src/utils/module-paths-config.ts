import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { type Availability, parseAvailability } from "@gram-lang/scheduler";
import { parse } from "yaml";

/**
 * Reads just the `paths:` alias map out of `<projectRoot>/.gram/config.yaml`
 * (module-imports RFC §B.1/§F.1) — the same field the CLI's `GramConfig`
 * schema validates in full (`packages/cli/src/types.ts:274`), but the
 * language server has no other use for the rest of that config today, so
 * this reads only the one field it needs instead of depending on the CLI's
 * config loader (and its zod schema, AI settings, etc.) from a package that
 * has no business knowing about them. Never throws — a missing, unreadable,
 * or malformed config file just means no aliases are known, the same
 * degrade-gracefully rule every other module-resolution failure here
 * follows.
 */
export function readPathsConfigSync(
	projectRoot: string,
): Record<string, string> | undefined {
	const configPath = join(projectRoot, ".gram", "config.yaml");
	if (!existsSync(configPath)) return undefined;
	try {
		const content = readFileSync(configPath, "utf-8");
		const parsed = parse(content) as { paths?: unknown } | undefined;
		const paths = parsed?.paths;
		if (!paths || typeof paths !== "object") return undefined;
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(paths)) {
			if (typeof value === "string") result[key] = value;
		}
		return result;
	} catch {
		return undefined;
	}
}

/**
 * Reads the `timezone:` of `<projectRoot>/.gram/config.yaml`, the zone a
 * serving time is written in (the CLI's `gram config set timezone`). Never
 * throws, like `readPathsConfigSync`: a missing, unreadable or unknown zone is
 * `undefined`, and the caller falls back on the machine's.
 */
export function readTimeZoneConfigSync(
	projectRoot: string,
): string | undefined {
	const configPath = join(projectRoot, ".gram", "config.yaml");
	if (!existsSync(configPath)) return undefined;
	try {
		const parsed = parse(readFileSync(configPath, "utf-8")) as
			| { timezone?: unknown }
			| undefined;
		const zone = parsed?.timezone;
		if (typeof zone !== "string" || zone === "") return undefined;
		new Intl.DateTimeFormat("en", { timeZone: zone });
		return zone;
	} catch {
		return undefined;
	}
}

/**
 * Reads the `availability:` of `<projectRoot>/.gram/config.yaml`, when the
 * cook is available (the CLI's default of `--available`): one entry
 * ("08:00-22:00") or a list of them. Never throws, like
 * `readTimeZoneConfigSync`: a missing or unreadable setting, or one that does
 * not parse, is `undefined`, and the caller falls back on all day.
 */
export function readAvailabilityConfigSync(
	projectRoot: string,
): Availability | undefined {
	const configPath = join(projectRoot, ".gram", "config.yaml");
	if (!existsSync(configPath)) return undefined;
	try {
		const parsed = parse(readFileSync(configPath, "utf-8")) as
			| { availability?: unknown }
			| undefined;
		const value = parsed?.availability;
		const entries =
			typeof value === "string"
				? [value]
				: Array.isArray(value) && value.every((v) => typeof v === "string")
					? (value as string[])
					: undefined;
		if (!entries || entries.length === 0 || entries[0] === "") return undefined;
		const result = parseAvailability(entries);
		return result.ok ? result.availability : undefined;
	} catch {
		return undefined;
	}
}

const MEAL_TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Reads the `mealTimes:` of `<projectRoot>/.gram/config.yaml`, the times of
 * day a serving time is looked for at (the CLI's default of `gram plan
 * --meal-times`). Never throws: a missing setting, or one that is not a list
 * of "HH:MM", is `undefined`, and the scheduler's own times are used.
 */
export function readMealTimesConfigSync(
	projectRoot: string,
): string[] | undefined {
	const configPath = join(projectRoot, ".gram", "config.yaml");
	if (!existsSync(configPath)) return undefined;
	try {
		const parsed = parse(readFileSync(configPath, "utf-8")) as
			| { mealTimes?: unknown }
			| undefined;
		const value = parsed?.mealTimes;
		if (
			!Array.isArray(value) ||
			value.length === 0 ||
			!value.every((v) => typeof v === "string" && MEAL_TIME.test(v))
		) {
			return undefined;
		}
		return value as string[];
	} catch {
		return undefined;
	}
}
