import type { IngredientData } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { GramParseError, getAST } from "@gram-lang/parser";
import {
	type LintDiagnostic,
	type LintFix,
	type LintInput,
	lintDocument,
} from "../../src/lint";

export const URI = "/recipe.gram";

/** One file, parsed and compiled, then linted. */
export function lintText(
	text: string,
	extra: Partial<LintInput> = {},
): LintDiagnostic[] {
	try {
		const ast = getAST(text);
		return lintDocument({
			uri: URI,
			text,
			ast,
			compilation: compile(ast),
			...extra,
		});
	} catch (e) {
		if (!(e instanceof GramParseError)) throw e;
		return lintDocument({
			uri: URI,
			text,
			ast: null,
			parseError: { message: e.message, offset: e.offset },
		});
	}
}

/** The diagnostics of one code. */
export function lintCode(
	code: string,
	text: string,
	extra: Partial<LintInput> = {},
): LintDiagnostic[] {
	return lintText(text, extra).filter((d) => d.code === code);
}

/** What a diagnostic's `loc` covers in `text`. */
export const spanOf = (text: string, d: LintDiagnostic) =>
	text.slice(d.loc!.start, d.loc!.end);

/** The text of `uri` once one fix's patches are applied to it. */
export function applyFix(text: string, fix: LintFix, uri = URI): string {
	let out = text;
	for (const edit of fix.edits) {
		if (edit.kind !== "patch" || edit.uri !== uri) continue;
		for (const p of [...edit.patches].sort((a, b) => b.start - a.start))
			out = out.slice(0, p.start) + p.replacement + out.slice(p.end);
	}
	return out;
}

export const entry = (name: string): IngredientData =>
	({ name }) as IngredientData;
