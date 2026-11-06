import {
	FORMAT_DEFINITIONS,
	FORMATS,
	type Format,
	type OutputDefinition,
	type StageArtifacts,
	type SurfaceOptions,
	type ViewInput,
	outputs,
} from "@gram-lang/renderer";
import type { GramLocale } from "@gram-lang/i18n";

/**
 * The formats the playground shows on screen, in the renderer's order: those
 * whose `display` is not `none` (print is a document for a printer).
 */
const SCREEN_FORMATS: readonly Format[] = FORMATS.filter(
	(format) => FORMAT_DEFINITIONS[format].display !== "none",
);

/** One output, as a tab or a menu item names it. */
export interface OutputOption {
	label: string;
	value: string;
}

function optionsOf(
	t: GramLocale,
	kind: OutputDefinition["kind"],
): OutputOption[] {
	return outputs
		.filter((output) => output.kind === kind)
		.map((output) => ({
			label: t.renderer.outputs[output.id] ?? output.id,
			value: output.id,
		}));
}

/** The views of the recipe, in the registry's order: the tabs of the output pane. */
export function viewTabs(t: GramLocale): OutputOption[] {
	return optionsOf(t, "renderer");
}

/** The inspectors of the pipeline: a menu of their own, apart from the views. */
export function inspectorOptions(t: GramLocale): OutputOption[] {
	return optionsOf(t, "inspector");
}

export function outputById(id: string): OutputDefinition | undefined {
	return outputs.find((output) => output.id === id);
}

/** The formats of an output the playground can show, in the renderer's order. `[]` for an inspector. */
export function screenFormatsOf(
	output: OutputDefinition | undefined,
): Format[] {
	if (output?.kind !== "renderer") return [];
	return SCREEN_FORMATS.filter((format) => output.formats.includes(format));
}

/** The format to show `output` in: `wanted` when it has it, else its first. */
export function formatFor(
	output: OutputDefinition | undefined,
	wanted: Format,
): Format {
	const formats = screenFormatsOf(output);
	return formats.includes(wanted) ? wanted : (formats[0] ?? "html");
}

/** How a pane shows an output, read from its descriptor and the chosen format. */
export interface Pane {
	/** Rendered HTML, highlighted text, or the JSON tree. */
	type: "html" | "code" | "tree";
	/** The highlighting of a code pane. */
	language?: string;
}

export function paneOf(
	output: OutputDefinition | undefined,
	format: Format,
): Pane {
	if (!output) return { type: "html" };
	if (output.kind === "inspector") {
		return output.presentation === "tree"
			? { type: "tree" }
			: { type: "code", ...(output.language && { language: output.language }) };
	}
	const { display, language } = FORMAT_DEFINITIONS[format];
	if (display === "page") return { type: "html" };
	return { type: "code", language: language ?? "text" };
}

/**
 * The output, written: a view of the prepared recipe in `format`, or an
 * inspector's look at its stage. `null` when the recipe has nothing for the
 * view. Throws what the renderer throws.
 */
export function renderOutput(
	output: OutputDefinition,
	format: Format,
	input: ViewInput,
	artifacts: Partial<StageArtifacts>,
	surface: SurfaceOptions,
): string | null {
	if (output.kind === "renderer") return output.render(input, format, surface);
	const artifact = artifacts[output.stage];
	if (artifact === undefined) return null;
	return (output.serialize as (artifact: unknown) => string)(artifact);
}
