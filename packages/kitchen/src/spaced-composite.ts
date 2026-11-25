import {
	ASTNodeType,
	type IngredientAST,
	type StepAST,
	type TextAST,
} from "@gram-lang/parser";
import { pushWarning, type Warning, WarningCode } from "./warnings";

/**
 * Flags `@lemon zest{1} < @lemon{2}`: with spaces around `<`, the parser
 * reads two separate ingredients and a text `<` between them, so the parent
 * is bought on top of the child's own entry (two lemons too many) with no
 * error. The step's meaning is left as written: the warning only makes the
 * slip visible, and a tool glues the operator back (`<@lemon`).
 */
export function warnSpacedComposites(
	children: StepAST["children"],
	target: Warning[] | { warnings: Warning[] },
): void {
	for (let i = 0; i + 2 < children.length; i++) {
		const child = children[i];
		const gap = children[i + 1];
		const parent = children[i + 2];
		if (
			child?.type !== ASTNodeType.Ingredient ||
			gap?.type !== ASTNodeType.Text ||
			parent?.type !== ASTNodeType.Ingredient
		)
			continue;
		const childIngredient = child as IngredientAST;
		const parentIngredient = parent as IngredientAST;
		if (childIngredient.composite) continue;
		if ((gap as TextAST).value.trim() !== "<") continue;
		const loc =
			childIngredient.loc && parentIngredient.loc
				? {
						...childIngredient.loc,
						end: parentIngredient.loc.end,
					}
				: undefined;
		pushWarning(target, WarningCode.SPACED_COMPOSITE, {
			item: childIngredient.name,
			parent: parentIngredient.name,
			suggestion: `<@${parentIngredient.name}`,
			loc,
		});
	}
}
