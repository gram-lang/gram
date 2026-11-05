import type { InspectorDefinition } from "../contract";
import { renderJsonTree } from "./json-tree";
import { renderSExpr } from "./s-expr";

/** The composed AST, after `@use` resolution, as an S-expression. */
export const astInspector = {
	id: "ast",
	kind: "inspector",
	stage: "composedAst",
	presentation: "code",
	language: "scheme",
	serialize: (ast) => renderSExpr(ast),
} as const satisfies InspectorDefinition<"composedAst">;

/** The analyzed recipe, as JSON. */
export const jsonInspector = {
	id: "json",
	kind: "inspector",
	stage: "analyzed",
	presentation: "code",
	language: "json",
	serialize: (recipe) => JSON.stringify(recipe, null, 2),
} as const satisfies InspectorDefinition<"analyzed">;

/** The analyzed recipe, as a tree that folds. */
export const jsonTreeInspector = {
	id: "json-tree",
	kind: "inspector",
	stage: "analyzed",
	presentation: "tree",
	serialize: (recipe) => renderJsonTree(recipe),
} as const satisfies InspectorDefinition<"analyzed">;

/** Every inspector, in the order the surfaces list them. */
export const inspectors = [
	astInspector,
	jsonInspector,
	jsonTreeInspector,
] as const;

/** The id of an inspector of the registry. */
export type InspectorId = (typeof inspectors)[number]["id"];

/** The inspector of the registry with this id, or `undefined`. */
export function getInspector(id: string): InspectorDefinition | undefined {
	return (inspectors as readonly InspectorDefinition[]).find(
		(inspector) => inspector.id === id,
	);
}
