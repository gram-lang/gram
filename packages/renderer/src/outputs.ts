import type { OutputDefinition } from "./contract";
import {
	astInspector,
	jsonInspector,
	jsonTreeInspector,
} from "./inspectors/registry";
import type { inspectors } from "./inspectors/registry";
import { recipeView } from "./views/recipe/view";
import { workPlanView } from "./views/work-plan/view";
import type { views } from "./views/registry";

/**
 * Every output a surface can show, the views first, then the inspectors. A
 * surface builds its selector from this list, grouped by `kind`.
 *
 * Written out rather than spread from `views` and `inspectors`: a bundler
 * cannot prove a spread free of side effects, so it would keep every view in
 * a page that only imports a helper of the renderer. A test checks that this
 * list is `views` then `inspectors`.
 */
export const outputs: readonly OutputDefinition[] = [
	recipeView,
	workPlanView,
	astInspector,
	jsonInspector,
	jsonTreeInspector,
];

/** The id of any output: a view or an inspector. */
export type OutputId =
	| (typeof views)[number]["id"]
	| (typeof inspectors)[number]["id"];
