import type { ChoiceSetting } from "@gram-lang/renderer";
import { ExitCode, GramCLIError, reportError } from "../errors";

/**
 * How a setting's value is written on the command line: kebab-case, as every
 * other flag value (`perSection` → `per-section`, `per100g` → `per-100g`).
 * The renderer, the editor and the playground keep the camelCase value; this
 * spelling is the CLI's alone.
 */
export function toFlagValue(value: string): string {
	return value
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/([a-z])(\d)/g, "$1-$2")
		.toLowerCase();
}

/** The values a choice flag accepts, in the order of the setting. */
export function flagValues(setting: ChoiceSetting): string[] {
	return setting.values.map(toFlagValue);
}

/** `a | b | c`, for a flag's help text. */
export function flagValueList(setting: ChoiceSetting): string {
	return flagValues(setting).join(" | ");
}

/** The default of a choice flag, as written on the command line. */
export function flagDefault(setting: ChoiceSetting): string {
	return toFlagValue(setting.default);
}

/**
 * The setting's value for a flag, or `undefined` when the flag is absent.
 * Unlike the setting's own tolerant `parse`, an unknown value is reported and
 * ends the command: it is an argument-validation failure raised before any
 * work starts, from a command's `run()`, where a throw would surface as a
 * stack trace instead of a message.
 */
export function parseChoiceFlag<V extends string>(
	setting: ChoiceSetting<V>,
	flag: string,
	value: unknown,
): V | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	const match = setting.values.find((v) => toFlagValue(v) === String(value));
	if (match !== undefined) return match;
	reportError(
		new GramCLIError(
			`Unknown --${flag} value "${value}". Expected one of: ${flagValues(setting).join(", ")}.`,
			ExitCode.Error,
		),
	);
	return process.exit(ExitCode.Error);
}
