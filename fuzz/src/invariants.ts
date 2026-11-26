import { hasChanges } from "@gram-lang/format";
import { allDiagnosticInfo } from "@gram-lang/modules/lint";
import { GramParseError } from "@gram-lang/parser";
import {
	firstDifference,
	MEANING_REPAIRS,
	normalize,
	pathShape,
} from "./normalize";
import { type Outcome, Prepared } from "./prepared";
import { signatureOf } from "./signature";

export interface Violation {
	invariant: string;
	message: string;
	signature: string;
	stack?: string;
}

export interface Invariant {
	id: string;
	check(input: Prepared): Violation | null;
}

function violation(
	invariant: string,
	message: string,
	error?: unknown,
): Violation {
	return {
		invariant,
		message,
		signature: signatureOf(invariant, message, error),
		...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
	};
}

function describe(error: unknown): string {
	return error instanceof Error
		? `${error.name}: ${error.message}`
		: String(error);
}

/** A stage that threw where it must not. */
function noThrow(
	id: string,
	outcome: Outcome<unknown> | null,
	stage: string,
): Violation | null {
	if (!outcome || outcome.ok) return null;
	return violation(
		id,
		`${stage} threw ${describe(outcome.error)}`,
		outcome.error,
	);
}

/**
 * The time an input may take through parse + compile + format + lint, in ms. Wide on
 * purpose: it catches a super-linear blow-up, not a slow CI runner.
 */
export function timeBudget(length: number): number {
	return 200 + 0.05 * length;
}

export const INVARIANTS: readonly Invariant[] = [
	{
		id: "parse-contract",
		check: ({ parse, source }) => {
			if (parse.ok) return null;
			const e = parse.error;
			if (!(e instanceof GramParseError)) {
				return violation(
					"parse-contract",
					`getAST threw ${describe(e)} instead of GramParseError`,
					e,
				);
			}
			if (
				!Number.isInteger(e.offset) ||
				e.offset < 0 ||
				e.offset > source.length
			) {
				return violation(
					"parse-contract",
					"GramParseError.offset outside [0, source.length]",
				);
			}
			if (typeof e.expected !== "string" || e.expected.trim() === "") {
				return violation("parse-contract", "GramParseError.expected is empty");
			}
			return null;
		},
	},
	{
		id: "compile-no-throw",
		check: (p) => noThrow("compile-no-throw", p.compile, "compile"),
	},
	{
		id: "analyze-no-throw",
		check: (p) => noThrow("analyze-no-throw", p.analyze, "analyze"),
	},
	{
		id: "format-no-throw",
		check: (p) => noThrow("format-no-throw", p.format, "formatGram"),
	},
	{
		id: "format-idempotent",
		check: (p) => {
			const once = p.format;
			const twice = p.reformat;
			if (!once.ok || !twice) return null;
			if (!twice.ok)
				return violation(
					"format-idempotent",
					`second formatGram threw ${describe(twice.error)}`,
					twice.error,
				);
			if (twice.value.content !== once.value.content) {
				const rules = Object.entries(twice.value.changes)
					.filter(([, n]) => n !== 0 && n !== false)
					.map(([rule]) => rule);
				return violation(
					"format-idempotent",
					`second pass changed the output (${rules.join(", ") || "no rule reported"})`,
				);
			}
			if (hasChanges(twice.value.changes)) {
				return violation(
					"format-idempotent",
					"second pass reported changes on an unchanged output",
				);
			}
			return null;
		},
	},
	{
		id: "format-preserves-meaning",
		check: (p) => {
			// An input that does not parse may be "repaired" by the formatter:
			// not a violation. One whose compilation throws is I2's business.
			if (!p.parse.ok || !p.compile?.ok) return null;
			const after = p.formattedCompile;
			if (!after || !p.format.ok) return null;
			const changes = p.format.value.changes;
			if (MEANING_REPAIRS.some((rule) => changes[rule])) return null;
			if (!after.parse.ok) {
				return violation(
					"format-preserves-meaning",
					"formatted source no longer parses",
					after.parse.error,
				);
			}
			if (!after.compile?.ok) {
				return violation(
					"format-preserves-meaning",
					"formatted source no longer compiles",
					after.compile?.error,
				);
			}
			const diff = firstDifference(
				normalize(p.compile.value),
				normalize(after.compile.value),
			);
			if (!diff) return null;
			return violation(
				"format-preserves-meaning",
				`compilation differs after formatting at ${pathShape(diff)}`,
			);
		},
	},
	{
		id: "lint-contract",
		check: (p) => {
			const thrown = noThrow("lint-contract", p.lint, "lintDocument");
			if (thrown || !p.lint.ok) return thrown;
			const known = new Set(allDiagnosticInfo().map((i) => i.code));
			const stray = p.lint.value.find((d) => !known.has(d.code));
			if (stray) {
				return violation(
					"lint-contract",
					`lintDocument returned ${stray.code}, which allDiagnosticInfo() does not list`,
				);
			}
			const outside = p.lint.value.find(
				(d) =>
					d.loc &&
					(d.loc.start < 0 ||
						d.loc.end < d.loc.start ||
						d.loc.start > p.source.length),
			);
			if (outside) {
				return violation(
					"lint-contract",
					`${outside.code} has a loc outside the source`,
				);
			}
			return null;
		},
	},
	{
		id: "time-budget",
		check: (p) => {
			const elapsed = (q: Prepared) =>
				q.parse.ms + (q.compile?.ms ?? 0) + q.format.ms + q.lint.ms;
			const budget = timeBudget(p.source.length);
			let ms = elapsed(p);
			// A GC pause or a cold JIT is not a blow-up: measure twice more, keep the best.
			for (let i = 0; i < 2 && ms > budget; i++)
				ms = Math.min(ms, elapsed(new Prepared(p.source, p.database)));
			if (ms <= budget) return null;
			return violation(
				"time-budget",
				`parse + compile + format + lint took ${Math.round(ms)} ms, budget ${Math.round(budget)} ms`,
			);
		},
	},
];

export function invariantsById(ids: readonly string[]): Invariant[] {
	return ids.map((id) => {
		const inv = INVARIANTS.find((i) => i.id === id);
		if (!inv)
			throw new Error(
				`unknown invariant "${id}" (known: ${INVARIANTS.map((i) => i.id).join(", ")})`,
			);
		return inv;
	});
}
