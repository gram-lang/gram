import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type Availability,
	availabilityEntries,
	isTimeZone,
	parseAvailability,
	parseMealTimes,
} from "@gram-lang/scheduler";
import { parse } from "yaml";

/** What the language server reads of a project's `.gram/config.yaml`. */
export interface ProjectConfig {
	/** The `paths:` aliases of `@use` (module-imports RFC §B.1/§F.1). */
	paths?: Record<string, string>;
	/** The zone a serving time is written in (`gram config set timezone`). */
	timeZone?: string;
	/** When the cook is available (the CLI's default of `--available`). */
	availability?: Availability;
	/** The times of day a serving time is looked for at (`gram plan --meal-times`). */
	mealTimes?: string[];
}

/**
 * Reads `<projectRoot>/.gram/config.yaml` once, for the fields the language
 * server uses. The CLI's `GramConfig` schema validates the whole file; this
 * reads only these fields rather than depending on the CLI's config loader
 * (its zod schema, AI settings…) from a package with no business knowing them.
 *
 * Never throws: a missing, unreadable or malformed file gives `{}`, and each
 * field is checked on its own, so a field that does not read (an unknown
 * zone, an availability like `8-22`) is left out without hiding the others.
 * The validations are the scheduler's, the same the CLI uses.
 */
export function readProjectConfigSync(projectRoot: string): ProjectConfig {
	const configPath = join(projectRoot, ".gram", "config.yaml");
	if (!existsSync(configPath)) return {};
	let raw: Record<string, unknown>;
	try {
		const parsed: unknown = parse(readFileSync(configPath, "utf-8"));
		if (!parsed || typeof parsed !== "object") return {};
		raw = parsed as Record<string, unknown>;
	} catch {
		return {};
	}
	const config: ProjectConfig = {};
	const paths = pathsOf(raw.paths);
	if (paths) config.paths = paths;
	if (typeof raw.timezone === "string" && isTimeZone(raw.timezone)) {
		config.timeZone = raw.timezone;
	}
	const entries = availabilityEntries(raw.availability);
	if (entries && entries.length > 0) {
		const availability = parseAvailability(entries);
		if (availability.ok) config.availability = availability.availability;
	}
	if (Array.isArray(raw.mealTimes) && raw.mealTimes.length > 0) {
		const strings = raw.mealTimes.every((v) => typeof v === "string");
		const meals = strings ? parseMealTimes(raw.mealTimes as string[]) : null;
		if (meals?.ok) config.mealTimes = meals.times;
	}
	return config;
}

/** The string aliases of a `paths:` map; any other value is dropped. */
function pathsOf(value: unknown): Record<string, string> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const paths: Record<string, string> = {};
	for (const [key, target] of Object.entries(value)) {
		if (typeof target === "string") paths[key] = target;
	}
	return paths;
}
