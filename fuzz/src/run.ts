import type { IngredientData } from "@gram-lang/analyzer";
import { exampleDatabase } from "./database";
import { INVARIANTS, type Invariant, type Violation } from "./invariants";
import { MUTATORS, type Mutator, mutate } from "./mutators";
import { Prepared } from "./prepared";
import { createRng, iterationSeed } from "./prng";

export interface CorpusEntry {
	id: string;
	content: string;
}

export interface GeneratedInput {
	index: number;
	corpusId: string;
	mutations: string[];
	input: string;
}

export interface Finding extends Violation, GeneratedInput {
	/** How many inputs of the run hit this signature. */
	count: number;
}

export interface RunOptions {
	seed: number;
	iterations: number;
	corpus: readonly CorpusEntry[];
	invariants?: readonly Invariant[];
	mutators?: readonly Mutator[];
	database?: Record<string, IngredientData>;
	/** Called after each input, e.g. for a progress line. */
	onInput?: (index: number) => void;
}

/** Input `index` of a run: a pure function of (seed, index, corpus). */
export function generateInput(
	seed: number,
	index: number,
	corpus: readonly CorpusEntry[],
	mutators: readonly Mutator[] = MUTATORS,
): GeneratedInput {
	const rng = createRng(iterationSeed(seed, index));
	const base = rng.pick(corpus);
	const donors = corpus.map((c) => c.content);
	const { output, applied } = mutate(base.content, rng, { donors }, mutators);
	return { index, corpusId: base.id, mutations: applied, input: output };
}

export function checkInput(
	input: string,
	invariants: readonly Invariant[] = INVARIANTS,
	database: Record<string, IngredientData> = exampleDatabase(),
): Violation[] {
	const prepared = new Prepared(input, database);
	const out: Violation[] = [];
	for (const inv of invariants) {
		const v = inv.check(prepared);
		if (v) out.push(v);
	}
	return out;
}

function collect(
	findings: Map<string, Finding>,
	violations: Violation[],
	generated: GeneratedInput,
): void {
	for (const v of violations) {
		const existing = findings.get(v.signature);
		if (existing) existing.count++;
		else findings.set(v.signature, { ...v, ...generated, count: 1 });
	}
}

/** Mutated inputs: one finding per signature, the first input that hit it. */
export function runFuzz(opts: RunOptions): Finding[] {
	const invariants = opts.invariants ?? INVARIANTS;
	const database = opts.database ?? exampleDatabase();
	const findings = new Map<string, Finding>();
	for (let i = 0; i < opts.iterations; i++) {
		const generated = generateInput(opts.seed, i, opts.corpus, opts.mutators);
		collect(
			findings,
			checkInput(generated.input, invariants, database),
			generated,
		);
		opts.onInput?.(i);
	}
	return [...findings.values()];
}

/** The corpus itself, unmutated (index -1, no mutation). */
export function scanCorpus(
	corpus: readonly CorpusEntry[],
	invariants: readonly Invariant[] = INVARIANTS,
	database: Record<string, IngredientData> = exampleDatabase(),
): Finding[] {
	const findings = new Map<string, Finding>();
	for (const entry of corpus) {
		const generated = {
			index: -1,
			corpusId: entry.id,
			mutations: [],
			input: entry.content,
		};
		collect(
			findings,
			checkInput(entry.content, invariants, database),
			generated,
		);
	}
	return [...findings.values()];
}
