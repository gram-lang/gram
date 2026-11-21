import type { Rng } from "./prng";

export interface MutationContext {
	/** Other sources to graft fragments from (crossover). */
	donors: readonly string[];
}

export interface Mutator {
	id: string;
	/** Relative frequency among the mutators. */
	weight: number;
	apply(source: string, rng: Rng, ctx: MutationContext): string;
}

const SYNTAX_CHARS = [
	"{",
	"}",
	"/",
	"|",
	"&",
	"@",
	"#",
	"~",
	"^",
	"=",
	"(",
	")",
	"[",
	"]",
	"<",
	">",
	"%",
	"?",
	"-",
	"+",
	"*",
	":",
	"'",
	'"',
] as const;

const BREAKS = ["\n", "\n\n", "\r\n", "\r"] as const;

const TRICKY_UNICODE = [
	" ", // no-break space
	"​", // zero-width space
	"﻿", // BOM
	"‏", // right-to-left mark
	"́", // combining acute accent
	"👩‍🍳", // multi-code-point emoji (ZWJ sequence)
	"\0",
	"\ud83d", // lone high surrogate
	"\udc00", // lone low surrogate
] as const;

const at = (source: string, rng: Rng) => rng.int(0, source.length);
const insert = (source: string, index: number, text: string) =>
	source.slice(0, index) + text + source.slice(index);

export const MUTATORS: readonly Mutator[] = [
	{
		id: "insert-syntax-char",
		weight: 5,
		apply: (s, rng) => insert(s, at(s, rng), rng.pick(SYNTAX_CHARS)),
	},
	{
		id: "insert-break",
		weight: 2,
		apply: (s, rng) => insert(s, at(s, rng), rng.pick(BREAKS)),
	},
	{
		id: "insert-unicode",
		weight: 2,
		apply: (s, rng) => insert(s, at(s, rng), rng.pick(TRICKY_UNICODE)),
	},
	{
		id: "delete-range",
		weight: 3,
		apply: (s, rng) => {
			const start = at(s, rng);
			return s.slice(0, start) + s.slice(start + rng.int(1, 8));
		},
	},
	{
		id: "duplicate-line",
		weight: 1,
		apply: (s, rng) => {
			const lines = s.split("\n");
			const i = rng.int(0, lines.length - 1);
			lines.splice(i, 0, lines[i] ?? "");
			return lines.join("\n");
		},
	},
	{
		id: "swap-lines",
		weight: 1,
		apply: (s, rng) => {
			const lines = s.split("\n");
			const i = rng.int(0, lines.length - 1);
			const j = rng.int(0, lines.length - 1);
			[lines[i], lines[j]] = [lines[j] ?? "", lines[i] ?? ""];
			return lines.join("\n");
		},
	},
	{
		id: "truncate",
		weight: 1,
		apply: (s, rng) => s.slice(0, at(s, rng)),
	},
	{
		id: "crossover",
		weight: 2,
		apply: (s, rng, ctx) => {
			if (ctx.donors.length === 0) return s;
			const donor = rng.pick(ctx.donors).split("\n");
			const from = rng.int(0, donor.length - 1);
			const fragment = donor.slice(from, from + rng.int(1, 4));
			const lines = s.split("\n");
			lines.splice(rng.int(0, lines.length), 0, ...fragment);
			return lines.join("\n");
		},
	},
];

function pickWeighted(rng: Rng, mutators: readonly Mutator[]): Mutator {
	const total = mutators.reduce((sum, m) => sum + m.weight, 0);
	let roll = rng.next() * total;
	for (const m of mutators) {
		roll -= m.weight;
		if (roll < 0) return m;
	}
	return mutators[mutators.length - 1] as Mutator;
}

/** Stacks 1 to 4 mutations on `source`. */
export function mutate(
	source: string,
	rng: Rng,
	ctx: MutationContext,
	mutators: readonly Mutator[] = MUTATORS,
): { output: string; applied: string[] } {
	let output = source;
	const applied: string[] = [];
	const count = rng.int(1, 4);
	for (let i = 0; i < count; i++) {
		const m = pickWeighted(rng, mutators);
		output = m.apply(output, rng, ctx);
		applied.push(m.id);
	}
	return { output, applied };
}
