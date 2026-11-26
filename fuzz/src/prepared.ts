import { analyze, type IngredientData } from "@gram-lang/analyzer";
import { formatGram } from "@gram-lang/format";
import { type CompilationResult, compile } from "@gram-lang/kitchen";
import {
	type LintDiagnostic,
	type LintInput,
	lintDocument,
} from "@gram-lang/modules/lint";
import { GramParseError, getAST, type RecipeAST } from "@gram-lang/parser";

export type Outcome<T> =
	| { ok: true; value: T; ms: number }
	| { ok: false; error: unknown; ms: number };

function attempt<T>(fn: () => T): Outcome<T> {
	const start = performance.now();
	try {
		const value = fn();
		return { ok: true, value, ms: performance.now() - start };
	} catch (error) {
		return { ok: false, error, ms: performance.now() - start };
	}
}

type Formatted = ReturnType<typeof formatGram>;

/**
 * Everything the invariants look at, computed once per input and only when
 * an invariant asks for it: the same string is never parsed twice.
 * A stage whose input stage failed is `null`.
 */
export class Prepared {
	readonly #cache = new Map<string, unknown>();

	constructor(
		readonly source: string,
		readonly database: Record<string, IngredientData>,
	) {}

	#memo<T>(key: string, fn: () => T): T {
		if (!this.#cache.has(key)) this.#cache.set(key, fn());
		return this.#cache.get(key) as T;
	}

	get parse(): Outcome<RecipeAST> {
		return this.#memo("parse", () => attempt(() => getAST(this.source)));
	}

	get compile(): Outcome<CompilationResult> | null {
		return this.#memo("compile", () => {
			const parsed = this.parse;
			return parsed.ok ? attempt(() => compile(parsed.value)) : null;
		});
	}

	get analyze(): Outcome<unknown> | null {
		return this.#memo("analyze", () => {
			const compiled = this.compile;
			return compiled?.ok
				? attempt(() => analyze(compiled.value, this.database))
				: null;
		});
	}

	get format(): Outcome<Formatted> {
		return this.#memo("format", () => attempt(() => formatGram(this.source)));
	}

	/**
	 * `lintDocument` on the source, as the language server calls it: the AST
	 * and the analyzed recipe when they exist, the parse error otherwise.
	 */
	get lint(): Outcome<LintDiagnostic[]> {
		return this.#memo("lint", () => {
			const parsed = this.parse;
			const analyzed = this.analyze;
			const parseError =
				!parsed.ok && parsed.error instanceof GramParseError
					? { message: parsed.error.message, offset: parsed.error.offset }
					: null;
			return attempt(() =>
				lintDocument({
					uri: "fuzz.gram",
					text: this.source,
					ast: parsed.ok ? parsed.value : null,
					parseError,
					compilation: analyzed?.ok
						? (analyzed.value as { result: LintInput["compilation"] }).result
						: this.compile?.ok
							? this.compile.value
							: null,
					ingredientDB: this.database,
				}),
			);
		});
	}

	/** `formatGram` run again on its own output. */
	get reformat(): Outcome<Formatted> | null {
		return this.#memo("reformat", () => {
			const formatted = this.format;
			return formatted.ok
				? attempt(() => formatGram(formatted.value.content))
				: null;
		});
	}

	/** The formatted source, parsed then compiled. */
	get formattedCompile(): {
		parse: Outcome<RecipeAST>;
		compile: Outcome<CompilationResult> | null;
	} | null {
		return this.#memo("formattedCompile", () => {
			const formatted = this.format;
			if (!formatted.ok) return null;
			const parse = attempt(() => getAST(formatted.value.content));
			return {
				parse,
				compile: parse.ok ? attempt(() => compile(parse.value)) : null,
			};
		});
	}
}
