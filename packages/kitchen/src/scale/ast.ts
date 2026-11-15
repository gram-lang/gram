import {
	ASTNodeType,
	type RecipeAST,
	type StepAST,
	type IngredientAST,
	type QuantityAST,
	type QuantityValueAST,
	type CompoundQuantityAST,
} from "@gram-lang/parser";
import { scaleTermsChecked, scaleUsageTerms, termsOfAst } from "../terms";

/**
 * Scales a quantity node in place, through the same helper as `applyScale`
 * (`scaleUsageTerms`), so the AST and the compiled recipe scale alike.
 */
function scaleQuantityNode(node: QuantityAST, factor: number): void {
	const total = scaleUsageTerms(termsOfAst(node), factor);
	if (total) node.value = total.qty as QuantityValueAST;
}

/**
 * Scales a sum in place, term by term, through the same `scaleTerms` as
 * `applyScale`: compiled afterwards, its parts and total come out as the
 * compiled recipe scaled.
 */
function scaleSumNode(node: CompoundQuantityAST, factor: number): void {
	for (const term of node.terms) {
		if (!term.value) continue;
		const [scaled] = scaleTermsChecked(
			[{ value: term.value, unit: term.unit }],
			factor,
		);
		if (scaled) term.value = scaled.value as QuantityValueAST;
	}
}

function scaleNode(
	node: IngredientAST["quantity"] | undefined,
	factor: number,
): void {
	if (!node || !("fixed" in node) || node.fixed) return;
	if (node.type === ASTNodeType.Quantity) scaleQuantityNode(node, factor);
	else if (node.type === ASTNodeType.CompoundQuantity)
		scaleSumNode(node, factor);
}

function scaleIngredient(ing: IngredientAST, factor: number): void {
	scaleNode(ing.quantity, factor);
	scaleNode(ing.composite?.quantity, factor);
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
