import type { RecipeAST } from "@gram-lang/parser";
import type { Finding, Snippet } from "../types";
import { collectIngredientCookwareNames, collectShapes } from "../vocabulary";

export interface TrustedVocabulary {
	shapes: Set<string>;
	hasHyphenatedNames: boolean;
}

export function buildTrustedVocabulary(trustedAsts: RecipeAST[]): TrustedVocabulary {
	const shapes = new Set<string>();
	let hasHyphenatedNames = false;

	for (const ast of trustedAsts) {
		for (const shape of collectShapes(ast)) shapes.add(shape);
		for (const name of collectIngredientCookwareNames(ast)) {
			if (name.includes("-")) hasHyphenatedNames = true;
		}
	}

	return { shapes, hasHyphenatedNames };
}

export function checkConstructVocabulary(
	snippet: Snippet,
	ast: RecipeAST,
	trusted: TrustedVocabulary,
): Finding[] {
	const findings: Finding[] = [];

	const shapes = collectShapes(ast);
	const unknown = [...shapes].filter((s) => !trusted.shapes.has(s));
	if (unknown.length > 0) {
		findings.push({
			snippetId: snippet.id,
			check: "vocabulary",
			severity: "flag",
			summary: `construct(s) not seen in the trusted syntax corpus: ${unknown.join(", ")}`,
		});
	}

	if (!trusted.hasHyphenatedNames) {
		const names = collectIngredientCookwareNames(ast);
		const kebab = names.filter((n) => n.includes("-"));
		if (kebab.length > 0) {
			findings.push({
				snippetId: snippet.id,
				check: "naming",
				severity: "flag",
				summary: `kebab-case ingredient/cookware name(s), never seen in the trusted corpus: ${kebab.join(", ")}`,
			});
		}
	}

	return findings;
}
