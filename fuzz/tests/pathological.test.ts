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
/** Measurements a stage must fail in a row to count as slow. */
const ATTEMPTS = 3;
/** Below this, the large input is too fast for its time to mean anything. */
const NOISE_FLOOR_MS = 20;

/**
 * The ratchet of this file: known super-linear cases, each tied to an issue.
 * They run as `it.failing`, so fixing one turns its test red until it is
 * removed from here. `scale` shrinks both sizes of a case too slow to run
 * at full size (its exponent does not depend on it).
 */
const KNOWN_SLOW: Record<string, { issue: string; scale?: number }> = {};

/** Growth exponent of each stage above the noise floor, from one measurement. */
function measureExponents(
	generate: (n: number) => string,
	small: number,
	large: number,
): Partial<Record<Stage, { k: number; a: number; b: number }>> {
	measure(generate(small)); // warm-up
	const a = measure(generate(small));
	const b = measure(generate(large));
	const out: Partial<Record<Stage, { k: number; a: number; b: number }>> = {};
	for (const stage of ["parse", "compile", "format"] as const) {
		if (b[stage] < NOISE_FLOOR_MS) continue;
		const k = Math.log(b[stage] / a[stage]) / Math.log(large / small);
		out[stage] = { k, a: a[stage], b: b[stage] };
	}
	return out;
}

/**
 * A stage is slow only if it is above `MAX_EXPONENT` in each of `ATTEMPTS`
 * measurements. A shared CI runner can stretch one large run (a GC pause, a
 * busy neighbour) and push a linear stage to n^1.2 once; a super-linear one
 * (F5 was n^2) is above the line every time. Kept: the lowest exponent seen.
 */
function exponents(generate: (n: number) => string, scale: number): string[] {
	const small = Math.round(SMALL * scale);
	const large = Math.round(LARGE * scale);
	let slow: Partial<Record<Stage, { k: number; a: number; b: number }>> | null =
		null;
	for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
		const now = measureExponents(generate, small, large);
		const next: typeof now = {};
		for (const stage of ["parse", "compile", "format"] as const) {
			const m = now[stage];
			if (!m || m.k <= MAX_EXPONENT) continue;
			const before = slow ? slow[stage] : m;
			if (before) next[stage] = before.k < m.k ? before : m;
		}
		slow = next;
		if (Object.keys(slow).length === 0) return [];
	}
	return Object.entries(slow ?? {}).map(
		([stage, m]) =>
			`${stage}: n^${m.k.toFixed(2)} (${m.a.toFixed(1)} ms at ${small}, ${m.b.toFixed(1)} ms at ${large})`,
	);
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
