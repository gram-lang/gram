import type { RecipeAST } from "@gram-lang/parser";
import type { Finding, Snippet } from "../types";
import { collectShapes } from "../vocabulary";

export interface TrustedVocabulary {
	shapes: Set<string>;
}

export function buildTrustedVocabulary(trustedAsts: RecipeAST[]): TrustedVocabulary {
	const shapes = new Set<string>();

	for (const ast of trustedAsts) {
		for (const shape of collectShapes(ast)) shapes.add(shape);
	}

	return { shapes };
}

export function checkConstructVocabulary(
	snippet: Snippet,
	ast: RecipeAST,
	trusted: TrustedVocabulary,
): Finding[] {
	const shapes = collectShapes(ast);
	const unknown = [...shapes].filter((s) => !trusted.shapes.has(s));
	if (unknown.length === 0) return [];

	return [
		{
			snippetId: snippet.id,
			check: "vocabulary",
			severity: "flag",
			summary: `construct(s) not seen in the trusted syntax corpus: ${unknown.join(", ")}`,
		},
	];
}
