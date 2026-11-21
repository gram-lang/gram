#!/usr/bin/env bun
/**
 * Deterministic fuzzing of the parser, the compiler, the analyzer and the formatter.
 *
 *   bun run fuzz                          # 2 000 inputs, random seed (printed)
 *   bun run fuzz --seed 1735549293 --iterations 200000 --minimize
 *   bun run fuzz --seed 1735549293 --index 4211   # replay one input
 *   bun run fuzz --corpus                 # the unmutated corpus only
 *   bun run fuzz --invariant format-idempotent --invariant format-no-throw
 */
import { parseArgs } from "node:util";
import { fuzzCorpus } from "./src/corpus";
import { INVARIANTS, invariantsById } from "./src/invariants";
import { knownFailures } from "./src/known-failures";
import {
	checkInput,
	type Finding,
	generateInput,
	runFuzz,
	scanCorpus,
} from "./src/run";
import { shrink } from "./src/shrink";

const { values } = parseArgs({
	options: {
		seed: { type: "string" },
		iterations: { type: "string", default: "2000" },
		index: { type: "string" },
		invariant: { type: "string", multiple: true },
		minimize: { type: "boolean", default: false },
		corpus: { type: "boolean", default: false },
	},
});

const seed =
	values.seed !== undefined
		? Number(values.seed) >>> 0
		: Math.floor(Math.random() * 0x100000000);
const iterations = Number(values.iterations);
const invariants = values.invariant?.length
	? invariantsById(values.invariant)
	: INVARIANTS;
const corpus = fuzzCorpus();

if (values.index !== undefined) {
	const generated = generateInput(seed, Number(values.index), corpus);
	console.log(
		`seed ${seed}, index ${generated.index}, from ${generated.corpusId}`,
	);
	console.log(`mutations: ${generated.mutations.join(", ")}`);
	console.log(`input: ${JSON.stringify(generated.input)}`);
	const violations = checkInput(generated.input, invariants);
	for (const v of violations)
		console.log(`\n✗ ${v.signature}\n${v.stack ?? v.message}`);
	if (violations.length === 0) console.log("\n✓ no violation");
	process.exit(violations.length > 0 ? 1 : 0);
}

const label = values.corpus
	? `${corpus.length} corpus snippets, unmutated`
	: `seed ${seed}, ${iterations} inputs`;
console.log(`fuzz: ${label}, ${invariants.length} invariants`);
const start = performance.now();
const findings: Finding[] = values.corpus
	? scanCorpus(corpus, invariants)
	: runFuzz({
			seed,
			iterations,
			corpus,
			invariants,
			onInput: (i) => {
				if (process.stdout.isTTY && i % 1000 === 999)
					process.stdout.write(`\r  ${i + 1}/${iterations}`);
			},
		});
if (process.stdout.isTTY) process.stdout.write("\r");
console.log(`done in ${((performance.now() - start) / 1000).toFixed(1)} s\n`);

const known = new Map(knownFailures().map((k) => [k.signature, k]));
let fresh = 0;
for (const f of findings) {
	const k = known.get(f.signature);
	if (!k) fresh++;
	console.log(
		`${k ? "known" : "NEW  "} ×${f.count}  ${f.signature}${k ? `  (${k.issue})` : ""}`,
	);
	if (!values.corpus)
		console.log(
			`        replay: bun run fuzz --seed ${seed} --index ${f.index}`,
		);
	else console.log(`        from:   ${f.corpusId}`);
	const input = values.minimize
		? shrink(f.input, (c) =>
				checkInput(c, invariants).some((v) => v.signature === f.signature),
			)
		: f.input;
	console.log(
		`        input${values.minimize ? " (minimized)" : ""}: ${JSON.stringify(input).slice(0, 400)}`,
	);
}
console.log(`\n${findings.length} signature(s), ${fresh} new`);
process.exit(fresh > 0 ? 1 : 0);
