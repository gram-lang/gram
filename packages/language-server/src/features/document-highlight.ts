import {
	type DocumentHighlight,
	DocumentHighlightKind,
	type Position,
} from "vscode-languageserver";
import type { IngredientAST } from "@gram-lang/parser";
import { slugify } from "@gram-lang/kitchen";
import type { DocumentState } from "../document-state";
import { locToRange, positionToOffset } from "../utils/position";
import {
	collectIngredients,
	collectIntermediates,
	collectReferences,
	collectRelativeTargets,
} from "@gram-lang/modules/lint";

/** One place a name is written, its sigil left out. */
interface Occurrence {
	/** `&name` (intermediate, import binding) or `@name` (ingredient, by id). */
	key: string;
	start: number;
	end: number;
	kind: DocumentHighlightKind;
}

/**
 * Where `name` is written inside `[start, end)`: its first occurrence, or
 * its last one when `last` (a name that ends what is written, after a
 * section title that may contain it too).
 */
function span(
	text: string,
	name: string,
	start: number,
	end: number,
	last = false,
): { start: number; end: number } | null {
	const slice = text.slice(start, end);
	const at = last ? slice.lastIndexOf(name) : slice.indexOf(name);
	if (at < 0) return null;
	return { start: start + at, end: start + at + name.length };
}

function ingredientOccurrences(
	ingredient: IngredientAST,
	text: string,
): Occurrence[] {
	const result: Occurrence[] = [];
	const loc = ingredient.loc;
	if (!loc) return result;
	const own = span(text, ingredient.name, loc.start, loc.end);
	if (own)
		result.push({
			key: `@${slugify(ingredient.name)}`,
			...own,
			kind: DocumentHighlightKind.Text,
		});
	// The parent of a composite (`@zest{1}<@lemon{2}`) is a mention of its own.
	const composite = ingredient.composite;
	if (composite?.loc) {
		const parent = span(
			text,
			composite.parent,
			composite.loc.start,
			composite.loc.end,
		);
		if (parent)
			result.push({
				key: `@${slugify(composite.parent)}`,
				...parent,
				kind: DocumentHighlightKind.Text,
			});
	}
	return result;
}

/**
 * Every name the document writes that a highlight can group: intermediates
 * (`->&name` and `@use ... as &name` write it, `&name` and the `&name`
 * target of a share or a ratio read it) and ingredients (each mention, a
 * composite's parent and the `@&name` target of a share or a ratio, matched
 * by id as the compilation does, so `@Flour` and `@flour` go together).
 */
function collectOccurrences(state: DocumentState): Occurrence[] {
	const ast = state.ast;
	if (!ast) return [];
	const { text } = state;
	const result: Occurrence[] = [];

	for (const decl of ast.imports) {
		for (const binding of decl.bindings) {
			if (!binding.loc) continue;
			// The local name ends the binding (`&a`, `&a as &b`).
			const at = span(
				text,
				binding.local,
				binding.loc.start,
				binding.loc.end,
				true,
			);
			if (at)
				result.push({
					key: `&${binding.local}`,
					...at,
					kind: DocumentHighlightKind.Write,
				});
		}
	}
	for (const { decl } of collectIntermediates(ast)) {
		if (!decl.loc) continue;
		const at = span(text, decl.name, decl.loc.start, decl.loc.end, true);
		if (at)
			result.push({
				key: `&${decl.name}`,
				...at,
				kind: DocumentHighlightKind.Write,
			});
	}
	for (const ref of collectReferences(ast)) {
		if (!ref.loc) continue;
		const at = span(text, ref.name, ref.loc.start, ref.loc.end);
		if (at)
			result.push({
				key: `&${ref.name}`,
				...at,
				kind: DocumentHighlightKind.Read,
			});
	}
	for (const ingredient of collectIngredients(ast))
		result.push(...ingredientOccurrences(ingredient, text));
	for (const target of collectRelativeTargets(ast, text)) {
		result.push({
			key:
				target.referenceType === "variable"
					? `&${target.name}`
					: `@${slugify(target.name)}`,
			start: target.start,
			end: target.end,
			kind: DocumentHighlightKind.Read,
		});
	}
	return result;
}

/**
 * The occurrences of the name under the cursor in this document: an
 * intermediate or an import binding (declarations as `Write`, uses as
 * `Read`), or an ingredient (mentions as `Text`, share and ratio targets as
 * `Read`). Only names are spans, never a whole mention, so the cursor on
 * `flour` in `@salt{2% @&flour}` is on flour, not on salt.
 */
export function provideDocumentHighlights(
	state: DocumentState,
	position: Position,
): DocumentHighlight[] {
	const occurrences = collectOccurrences(state);
	const offset = positionToOffset(state.lineStarts, position);
	const hit = occurrences.find((o) => o.start <= offset && offset <= o.end);
	if (!hit) return [];
	return occurrences
		.filter((o) => o.key === hit.key)
		.map((o) => ({
			range: locToRange(state.lineStarts, o),
			kind: o.kind,
		}));
}
