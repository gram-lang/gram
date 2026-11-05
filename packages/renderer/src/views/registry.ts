import type { Format, SurfaceOptions, ViewDefinition } from "../contract";
import type { ViewInput } from "../prepare-views";
import { recipeView } from "./recipe/view";
import { workPlanView } from "./work-plan/view";

/**
 * Every view of a recipe, in the order the surfaces list them. A surface
 * builds its choice of views from this list, so a view added here appears
 * everywhere.
 */
export const views = [recipeView, workPlanView] as const;

/** The id of a view of the registry. */
export type ViewId = (typeof views)[number]["id"];

/** The view of the registry with this id, or `undefined`. */
export function getView(id: string): ViewDefinition | undefined {
	return (views as readonly ViewDefinition[]).find((view) => view.id === id);
}

/**
 * One view of a prepared recipe, in one format. `null` when the recipe has
 * nothing for this view. Throws on an unknown view or a format it does not
 * offer: read `formats` to offer only what exists.
 */
export function render(
	viewId: ViewId,
	input: ViewInput,
	format: Format,
	surface?: SurfaceOptions,
): string | null {
	const view = getView(viewId);
	if (!view) throw new RangeError(`Unknown view "${viewId}".`);
	if (!view.formats.includes(format)) {
		throw new RangeError(`The "${viewId}" view has no "${format}" format.`);
	}
	return view.render(input, format, surface);
}
