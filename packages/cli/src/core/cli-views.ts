import {
	type Format,
	type ViewDefinition,
	type ViewId,
	views,
} from "@gram-lang/renderer";
import { ExitCode, GramCLIError } from "../errors";

/*
 * The renderer's views, as the command line names them. The registry is the
 * source of truth: a view added there is offered by `--view` of every command
 * that writes one, in the formats it really has, with no edit here.
 */

/** A view's name on the command line: its id in kebab case ("workPlan" → "work-plan"). */
export function cliViewName(id: string): string {
	return id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** Every view, by its command-line name, in the registry's order. */
export const CLI_VIEW_NAMES: readonly string[] = views.map((view) =>
	cliViewName(view.id),
);

/** The view `--view` names, or a usage error listing the views. */
export function viewByCliName(name: string): ViewDefinition {
	const view = (views as readonly ViewDefinition[]).find(
		(v) => cliViewName(v.id) === name,
	);
	if (!view) {
		throw new GramCLIError(
			`Unknown --view value "${name}". Expected one of: ${CLI_VIEW_NAMES.join(", ")}.`,
			ExitCode.Error,
		);
	}
	return view;
}

/**
 * What a command calls each format of the renderer, in the order it lists
 * them. Each command keeps its own words (`html` is the print-ready page for
 * `gram export`, the screen HTML for `gram plan`): they are released names.
 */
export type CliFormats = Readonly<Record<string, Format>>;

/** `gram export`: files to keep. */
export const EXPORT_FORMATS: CliFormats = {
	md: "markdown",
	html: "print",
	text: "text",
};

/** The file extension of each `gram export` format. */
export const EXPORT_EXTENSIONS: Readonly<Record<string, string>> = {
	md: "md",
	html: "html",
	text: "txt",
};

/** `gram plan`: the work plan on screen, or in a file. */
export const PLAN_SHEET_FORMATS: CliFormats = {
	text: "text",
	md: "markdown",
	html: "html",
};

/** The command-line names of the formats `view` has among `formats`. */
export function cliFormatsOf(
	view: ViewDefinition,
	formats: CliFormats,
): string[] {
	return Object.entries(formats)
		.filter(([, format]) => view.formats.includes(format))
		.map(([name]) => name);
}

/**
 * The renderer format of `--format name` for `view`, or a usage error that
 * lists what this view offers: a format the view does not have is not offered.
 */
export function resolveCliFormat(
	view: ViewDefinition,
	name: string,
	formats: CliFormats,
): Format {
	const offered = cliFormatsOf(view, formats);
	if (!offered.includes(name)) {
		const known = name in formats;
		throw new GramCLIError(
			known
				? `The ${cliViewName(view.id)} view has no "${name}" format. Expected one of: ${offered.join(", ")}.`
				: `Unknown --format value "${name}". Expected one of: ${offered.join(", ")}.`,
			ExitCode.Error,
		);
	}
	return formats[name] as Format;
}

/** Whether a view lays the recipe out in time, and so reads the plan flags. */
export const isPlanned = (view: ViewDefinition): boolean =>
	view.needs.includes("runSheet");

export type { ViewId };
