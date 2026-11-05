import {
	type DescribableDiagnostic,
	type ErrorDescription,
	type InspectorDefinition,
	type KitchenContext,
	type OutputDefinition,
	type StageArtifacts,
	type ViewInput,
	type ViewSettings,
	describeError,
	outputs,
	prepareViews,
} from "@gram-lang/renderer";
import type { DocumentState } from "./document-state";

/** What an inspector sends: text for a code pane, or the tree's HTML. */
export interface InspectorPayload {
	presentation: InspectorDefinition["presentation"];
	language?: InspectorDefinition["language"];
	text: string;
}

/** Why an output is paused: the primary error, for a banner and a "show problems" button. */
export type PausedError = Omit<
	ErrorDescription<DescribableDiagnostic>,
	"diagnostic"
>;

/**
 * The `gram/viewUpdated` notification: one output of one document.
 *
 * - `ok`: `payload` is the output. A view's HTML, or `null` when the recipe has
 *   nothing for it (a work plan of a recipe with no tasks); an inspector's
 *   `InspectorPayload`.
 * - `paused`: the recipe stopped compiling. No payload: the client keeps the
 *   last one it showed, under a banner made from `error`. `error.range` is in
 *   offsets into `error.uri` (an imported module), or into the document itself
 *   without it.
 */
export type ViewUpdate =
	| {
			uri: string;
			outputId: string;
			kind: OutputDefinition["kind"];
			state: "ok";
			payload: string | InspectorPayload | null;
	  }
	| {
			uri: string;
			outputId: string;
			kind: OutputDefinition["kind"];
			state: "paused";
			error: PausedError;
	  };

/**
 * The errors that stop the views of `state`, in the shape `describeError`
 * reads. The language server keeps one message per failed stage, so this is at
 * most one diagnostic, always blocking.
 */
export function blockingDiagnostics(
	state: DocumentState,
): DescribableDiagnostic[] {
	if (state.parseError != null) {
		return [
			{
				code: "PARSE_ERROR",
				message: state.parseError,
				severity: "error",
				blocking: true,
				...(state.parseErrorOffset !== null && {
					loc: { start: state.parseErrorOffset, end: state.parseErrorOffset },
				}),
			},
		];
	}
	if (state.compileError != null) {
		return [
			{
				code: "COMPILE_ERROR",
				message: state.compileError,
				severity: "error",
				blocking: true,
			},
		];
	}
	return [];
}

export interface RenderOutputsOptions {
	/** The view settings (`gram.*`). */
	settings: ViewSettings;
	/** Needed for a serving time and the serving time search. */
	kitchen: KitchenContext;
	/** When it is served, from the session; without, the plan is in days before the service. */
	serveAt?: string;
	/** The language of the editor, for the paused banner. */
	locale?: string;
	/** Told when one output throws: the others are still sent. */
	onError?: (outputId: string, error: unknown) => void;
}

/** The artifact of `stage`, or `undefined` when that stage did not produce one. */
function artifactOf(
	state: DocumentState,
	stage: keyof StageArtifacts,
): unknown | undefined {
	if (stage === "composedAst") return state.composedAst ?? undefined;
	return state.compilation ?? undefined;
}

/**
 * Renders the outputs `outputIds` of an already compiled document, and only
 * those: the costly parts of the views (the schedule, the work plan) are worked
 * out the first time an open view reads them, and never for a closed one. An
 * unknown id is skipped. Each output is rendered on its own: one that throws is
 * reported to `onError` and left out, the others are still returned.
 */
export function renderOutputs(
	uri: string,
	state: DocumentState,
	outputIds: Iterable<string>,
	options: RenderOutputsOptions,
): ViewUpdate[] {
	const wanted = new Set(outputIds);
	const open = outputs.filter((output) => wanted.has(output.id));
	if (open.length === 0) return [];

	const error = describeError(blockingDiagnostics(state), options.locale);
	let input: ViewInput | undefined;
	const inputOf = (): ViewInput => {
		if (!input) {
			const compilation = state.compilation;
			if (!compilation) throw new Error("no compilation to render");
			const lang = compilation.meta?.language;
			input = prepareViews(compilation, options.settings, {
				...(typeof lang === "string" && { lang }),
				kitchen: options.kitchen,
				...(options.serveAt && { serveAt: options.serveAt }),
			});
		}
		return input;
	};

	const updates: ViewUpdate[] = [];
	for (const output of open) {
		const base = { uri, outputId: output.id, kind: output.kind };
		try {
			if (output.kind === "renderer") {
				if (!state.compilation) {
					if (error) {
						const { diagnostic: _, ...paused } = error;
						updates.push({ ...base, state: "paused", error: paused });
					}
					continue;
				}
				// The VS Code panel ships the renderer's stylesheet, so the
				// CSS-only nutrition basis toggle works there; quantities stay
				// read-only.
				const html = output.render(inputOf(), "html", {
					interactiveNutrition: true,
				});
				updates.push({ ...base, state: "ok", payload: html });
			} else {
				const artifact = artifactOf(state, output.stage);
				if (artifact === undefined) {
					if (error) {
						const { diagnostic: _, ...paused } = error;
						updates.push({ ...base, state: "paused", error: paused });
					}
					continue;
				}
				const serialize = output.serialize as (artifact: unknown) => string;
				updates.push({
					...base,
					state: "ok",
					payload: {
						presentation: output.presentation,
						...(output.language && { language: output.language }),
						text: serialize(artifact),
					},
				});
			}
		} catch (e) {
			options.onError?.(output.id, e);
		}
	}
	return updates;
}
