import {
	ASTNodeType,
	type RecipeAST,
	type StepAST,
	type IngredientAST,
	type QuantityValueAST,
} from "@gram-lang/parser";
import { scaleQty } from "../utils";

function scaleQuantityValue(
	value: QuantityValueAST | undefined,
	factor: number,
): QuantityValueAST | undefined {
	if (!value) return value;
	return scaleQty(value, factor) as QuantityValueAST;
}

function scaleIngredient(ing: IngredientAST, factor: number): void {
	if (
		ing.quantity &&
		ing.quantity.type === ASTNodeType.Quantity &&
		!ing.quantity.fixed
	) {
		ing.quantity.value = scaleQuantityValue(ing.quantity.value, factor);
	}
	const compositeQty = ing.composite?.quantity;
	if (compositeQty && !compositeQty.fixed) {
		compositeQty.value = scaleQuantityValue(compositeQty.value, factor);
	}
}

function scaleStep(step: StepAST, factor: number): void {
	step.children.forEach((child) => {
		if (child.type === ASTNodeType.Ingredient) {
			scaleIngredient(child, factor);
		} else if (child.type === ASTNodeType.Alternative) {
			child.options.forEach((opt) => {
				if (opt.type === ASTNodeType.Ingredient) scaleIngredient(opt, factor);
				// CookwareAST options are deliberately left alone: cookwareQuantity
				// is a plain count with no unit, never scaled -- same as applyScale.
			});
		}
	});
}

/**
 * Visits every `StepAST` in `children` — at the top level, or nested one
 * level inside a `Section` — the two places a step can appear in a (grouped)
 * recipe/section child list. Shared by every pass that only cares about step
 * content (scaling here, reference collection in `@gram-lang/modules`), so
 * each stays a one-line callback instead of re-deriving this walk.
 */
export function forEachStep(
	children: RecipeAST["children"],
	visit: (step: StepAST) => void,
): void {
	children.forEach((child) => {
		if (child.type === ASTNodeType.Step) {
			visit(child);
		} else if (child.type === ASTNodeType.Section) {
			child.children.forEach((sectionChild) => {
				if (sectionChild.type === ASTNodeType.Step) {
					visit(sectionChild);
				}
			});
		}
	});
}

function scaleChildren(children: RecipeAST["children"], factor: number): void {
	forEachStep(children, (step) => scaleStep(step, factor));
}

/**
 * Scales every absolute ingredient/composite quantity in a recipe AST by
 * `factor`. Pure — the input is never mutated (`structuredClone`). Used by
 * the module composer (module-imports RFC, Phase D.3) to scale an imported
 * module's AST *before* splicing its sections into the host, so the whole
 * composed document is compiled — and ALAP-scheduled — exactly once.
 *
 * Must cover the exact same surface as `applyScale` (`../scale/engine.ts`),
 * which does the equivalent job on the *compiled* JSON instead of the AST:
 * relative quantities, text quantities, timers, temperatures, and cookware
 * quantities are all deliberately left untouched here too, for the same
 * reasons applyScale leaves them untouched downstream. Alternatives
 * (`AlternativeAST.options`) and composites (`CompositeAST.quantity`, the
 * parent's own share) are the two structures a naive walk over bare
 * `IngredientAST` nodes alone would miss — applyScale treats both
 * explicitly, so this does too.
 */
export function scaleAst(ast: RecipeAST, factor: number): RecipeAST {
	if (factor === 1) return ast;
	const cloned = structuredClone(ast);
	scaleChildren(cloned.children, factor);
	return cloned;
}
