import { describe, expect, it } from "bun:test";
import { fuzzCorpus } from "../src/corpus";
import { checkInput, type Finding, runFuzz, scanCorpus } from "../src/run";
import { knownFailures } from "../src/known-failures";
import { shrink } from "../src/shrink";

// Fixed on purpose: adjust ITERATIONS to the CI budget, never the seed at random.
const SEED = 0x6772616d;
const ITERATIONS = 2000;

const known = knownFailures();
const knownSignatures = new Set(known.map((k) => k.signature));

function report(f: Finding): string {
	const minimized = shrink(
		f.input,
		(c) => checkInput(c).some((v) => v.signature === f.signature),
		2000,
	);
	const replay =
		f.index < 0
			? `from ${f.corpusId}`
			: `bun run fuzz --seed ${SEED} --index ${f.index} (from ${f.corpusId}, ${f.mutations.join(", ")})`;
	return `${f.signature}\n  ${replay}\n  minimized: ${JSON.stringify(minimized)}\n  → fix it, or add it to fuzz/known-failures.json with an issue`;
}

describe("fuzz", () => {
	it("the unmutated corpus breaks no invariant beyond known failures", () => {
		const fresh = scanCorpus(fuzzCorpus()).filter(
			(f) => !knownSignatures.has(f.signature),
		);
		expect(fresh.map(report)).toEqual([]);
	}, 60_000);

	it(`${ITERATIONS} mutated inputs break no invariant beyond known failures`, () => {
		const findings = runFuzz({
			seed: SEED,
			iterations: ITERATIONS,
			corpus: fuzzCorpus(),
		});
		const fresh = findings.filter((f) => !knownSignatures.has(f.signature));
		expect(fresh.map(report)).toEqual([]);
	}, 60_000);

	it("every known failure still fails (else: drop it and add its example to fuzz/regressions/)", () => {
		const fixed = known
			.filter(
				(k) => !checkInput(k.example).some((v) => v.signature === k.signature),
			)
			.map((k) => `${k.signature} (${k.issue}): ${JSON.stringify(k.example)}`);
		expect(fixed).toEqual([]);
	});
});
