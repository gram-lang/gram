import {
	type Hover,
	type MarkupContent,
	MarkupKind,
	type Position,
} from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { positionToOffset } from "../utils/position";
import {
	collectIntermediates,
	collectReferences,
	getStepSourceText,
} from "@gram-lang/modules/lint";
import type { IngredientDB } from "../ingredient-loader";
import { provideNutritionHover } from "./hover-nutrition";
import { provideAnchorHover, provideTimerHover } from "./hover-durations";
import { provideFrontmatterHover } from "./hover-frontmatter";

export function provideHover(
	state: DocumentState,
	position: Position,
	db: IngredientDB,
	/** The editor's language: the descriptions of the frontmatter keys. */
	locale?: string,
): Hover | null {
	// Before the AST: a frontmatter being typed may not parse yet.
	const frontmatter = provideFrontmatterHover(state, position, locale);
	if (frontmatter) return frontmatter;

	if (!state.ast) return null;

	const offset = positionToOffset(state.lineStarts, position);

	// 1. Hover on &ref → show the step that produced it
	const refs = collectReferences(state.ast);
	const ref = refs.find(
		(r) => r.loc && r.loc.start <= offset && offset <= r.loc.end,
	);
	if (ref) {
		const decls = collectIntermediates(state.ast);
		const match = decls.find((d) => d.decl.name === ref.name);
		if (!match) return null;

		let description = "";
		if (match.step) {
			description = `\`\`\`gram\n${getStepSourceText(match.step, state.text)}\n\`\`\``;
		} else if (match.section) {
			description = `Section: **${match.section.title ?? "(unnamed)"}**`;
		}

		const contents: MarkupContent = {
			kind: MarkupKind.Markdown,
			value: [`**\`->&${ref.name}\`**`, description]
				.filter(Boolean)
				.join("\n\n"),
		};
		return { contents };
	}

	// 2. Hover on ~timer or a section anchor → the duration as Gram reads it
	const durationHover =
		provideTimerHover(state, offset) ?? provideAnchorHover(state, offset);
	if (durationHover) return durationHover;

	// 3. Hover on @ingredient → show nutrition + unit conversion
	return provideNutritionHover(state, position, db);
}
