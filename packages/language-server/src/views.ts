import {
	type DescribableDiagnostic,
	type KitchenContext,
	type ServeSuggestions,
	type StageArtifacts,
	type ViewInput,
	type ViewSettings,
	describeError,
	outputs,
	prepareViews,
	suggestServeTimes,
} from "@gram-lang/renderer";
import { getDictionary } from "@gram-lang/i18n";
import type { ModuleGraph } from "@gram-lang/modules";
import type { DocumentState } from "./document-state";
import type { SessionChoices, ViewUpdate, ViewsCapability } from "./protocol";

export type {
	InspectorPayload,
	PausedError,
	SessionChoices,
	ViewUpdate,
	ViewsCapability,
} from "./protocol";

export function describeOutputs(locale?: string): ViewsCapability {
	const t = getDictionary(locale).renderer;
	return {
		outputs: outputs.map((output) => ({
			id: output.id,
			kind: output.kind,
			label: t.outputs[output.id] ?? output.id,
			...(output.kind === "inspector"
				? { presentation: output.presentation }
				: { needs: output.needs }),
		})),
		strings: {
			showError: t.showError,
			outputEmpty: t.outputEmpty,
			serving: { ...t.serving },
			session: { ...t.session },
		},
	};
}

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
 * those: the costly parts of the views (the schedule, the run sheet) are worked
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

export interface ServeTimesOptions {
	settings: ViewSettings;
	kitchen: KitchenContext;
	/** The language of the editor: the suggestions are words of its panel. */
	locale?: string;
	/** The times of day to try, from the project's `mealTimes`. */
	mealTimes?: string[];
}

/**
 * `gram/serveTimes`: the serving times to propose next to the serving time
 * field of a view laid out in time, as the playground proposes them. Asked by
 * the client only while its suggestions are shown: it plans a few dozen times.
 * `null` without a compilation or without anything to schedule.
 */
export function serveTimesOf(
	state: DocumentState,
	options: ServeTimesOptions,
): ServeSuggestions | null {
	const compilation = state.compilation;
	if (!compilation) return null;
	const lang = compilation.meta?.language;
	const input = prepareViews(compilation, options.settings, {
		...(typeof lang === "string" && { lang }),
		kitchen: options.kitchen,
	});
	const words = options.locale ?? (typeof lang === "string" ? lang : undefined);
	return suggestServeTimes(input, {
		...(words !== undefined && { lang: words }),
		...(options.mealTimes && { mealTimes: options.mealTimes }),
	});
}

/**
 * `gram/sessionChoices`: the ingredients, the imports and the baker's math of
 * a recipe, read from its source as written (`state`), not from the views'
 * scaled compilation, so the choices do not move with the scale. `null`
 * without a compilation.
 */
export function sessionChoicesOf(
	state: DocumentState,
	options: {
		graph?: ModuleGraph;
		bakersMath: boolean;
		/** The views' compilation, which carries the scale error. */
		viewState?: DocumentState;
	},
): SessionChoices | null {
	const compilation = state.compilation;
	if (!compilation) return null;
	const ingredients = (compilation.shopping_list ?? []).map((item) => ({
		id: item.id,
		name: item.name || item.id,
		...(typeof item.qty === "number" && { qty: item.qty }),
		...(item.unit && { unit: item.unit }),
	}));
	// Every import edge, wherever it is declared: a stocked import can be
	// nested at any depth, as in the playground.
	const imports: SessionChoices["imports"] = [];
	const seen = new Set<string>();
	const graph = options.graph;
	for (const uri of graph?.order ?? []) {
		for (const { decl, uri: depUri } of graph?.modules.get(uri)?.imports ??
			[]) {
			if (seen.has(depUri)) continue;
			seen.add(depUri);
			imports.push({ uri: depUri, specifier: decl.specifier });
		}
	}
	const scaleError = options.viewState?.scaleError;
	return {
		ingredients,
		imports,
		bakersMath: options.bakersMath,
		...(scaleError && { scaleError }),
	};
}
