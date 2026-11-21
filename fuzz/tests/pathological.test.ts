import { describe, expect, it } from "bun:test";
import { formatGram } from "@gram-lang/format";
import { compile } from "@gram-lang/kitchen";
import { getAST, type RecipeAST } from "@gram-lang/parser";

/** Best of three, in ms: a GC pause or a cold JIT only ever adds time. */
function best(fn: () => unknown): number {
	let min = Number.POSITIVE_INFINITY;
	for (let i = 0; i < 3; i++) {
		const start = performance.now();
		try {
			fn();
		} catch {
			// Only the time matters here; the other tests own the outcomes.
		}
		min = Math.min(min, performance.now() - start);
	}
	return min;
}

type Stage = "parse" | "compile" | "format";

/** Each stage timed on its own, so a slow stage is not diluted by the others. */
function measure(source: string): Record<Stage, number> {
	let ast: RecipeAST | null = null;
	const parse = best(() => {
		ast = getAST(source);
	});
	const parsed = ast as RecipeAST | null;
	const compileMs = parsed ? best(() => compile(parsed)) : 0;
	return { parse, compile: compileMs, format: best(() => formatGram(source)) };
}

// Worst cases for a backtracking grammar or a regex-heavy formatter.
const GENERATORS: Record<string, (n: number) => string> = {
	"a long line with no break": (n) => `Mix ${"a".repeat(n)}`,
	"nested opening braces": (n) => `Mix @flour${"{".repeat(n)}`,
	"a run of @": (n) => "@".repeat(n),
	"ranges and sums in series": (n) =>
		`Add @flour{${"1-2 g + ".repeat(n / 8)}1 g}.`,
	"an unclosed frontmatter": (n) =>
		`---\ntitle: x\n${"key: value\n".repeat(n / 11)}`,
	"many steps": (n) => "Mix @flour{1 g}.\n\n".repeat(n / 18),
};

/**
 * Growth is judged by its exponent between a small and a large input
 * (t ∝ n^k, k = log(t_large / t_small) / log(16)): linear code measures
 * 0.90-1.06, a quadratic step hidden behind linear work already shows
 * 1.24 (the compound-quantity AST before its fix), a fully quadratic one 2.
 */
const SMALL = 3_125;
const LARGE = 50_000;
const MAX_EXPONENT = 1.15;
/** Below this, the large input is too fast for its time to mean anything. */
const NOISE_FLOOR_MS = 20;

/**
 * The ratchet of this file: known super-linear cases, each tied to an issue.
 * They run as `it.failing`, so fixing one turns its test red until it is
 * removed from here. `scale` shrinks both sizes of a case too slow to run
 * at full size (its exponent does not depend on it).
 */
const KNOWN_SLOW: Record<string, { issue: string; scale?: number }> = {};

function exponents(generate: (n: number) => string, scale: number): string[] {
	const small = Math.round(SMALL * scale);
	const large = Math.round(LARGE * scale);
	measure(generate(small)); // warm-up
	const a = measure(generate(small));
	const b = measure(generate(large));
	const slow: string[] = [];
	for (const stage of ["parse", "compile", "format"] as const) {
		if (b[stage] < NOISE_FLOOR_MS) continue;
		const k = Math.log(b[stage] / a[stage]) / Math.log(large / small);
		if (k > MAX_EXPONENT) {
			slow.push(
				`${stage}: n^${k.toFixed(2)} (${a[stage].toFixed(1)} ms at ${small}, ${b[stage].toFixed(1)} ms at ${large})`,
			);
		}
	}
	return slow;
}

describe("growth stays near linear", () => {
	for (const [name, generate] of Object.entries(GENERATORS)) {
		const known = KNOWN_SLOW[name];
		const test = known ? it.failing : it;
		test(known ? `${name} (known: ${known.issue})` : name, () => {
			expect(exponents(generate, known?.scale ?? 1)).toEqual([]);
		}, 60_000);
	}
});
