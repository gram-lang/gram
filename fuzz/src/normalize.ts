import type { FormatterChanges } from "@gram-lang/format";

/**
 * Comparing two compilations "up to positions": the formatter moves text
 * around and canonicalizes spellings, while the meaning must not change.
 *
 * Every rule here is a deliberate, commented decision, each one checked
 * against the unmutated corpus. Never widen it to make a violation go away
 * without understanding it first: a difference is a formatter bug until a
 * rule below says it is a canonicalization.
 */

/** Keys dropped wherever they appear. */
export const POSITION_KEYS: ReadonlySet<string> = new Set([
	// Source location of AST nodes, copied onto usages and warnings.
	"loc",
	// Compiler name and version: not part of the recipe (same as
	// `withoutGenerator` in conformance/run.ts).
	"generator",
	// Source spelling of a quantity or timer (`180 °C`, `{1 cup+2 tbsp}`):
	// the formatter respaces it on purpose (rules 2-5); its parsed form
	// (`qty`, `unit`, `value`, durations) is still compared.
	"raw",
]);

/**
 * Formatter rules that *repair* a common mistake into the syntax the author
 * meant, so they change the compilation by design: `@a{} < @b{}` becomes a
 * composite (rule 6), `->&dough {}` a declaration (rule 7), `##Prep` a
 * section header instead of `#` + cookware `#Prep` (rule 8). I6 does not
 * compare an input on which one of them fired.
 */
export const MEANING_REPAIRS: readonly (keyof FormatterChanges)[] = [
	"compositeSeparatorSpacing",
	"arrowDeclarationSpacing",
	"headerSpacing",
];

/**
 * Rule 4 of the formatter, as `DECIMAL_WITH_ZEROS` in packages/format reads
 * it: the trailing decimal zeros of a number standing on its own, never a
 * fraction's term (#286) nor a comma followed by three digits (a possible
 * thousands separator).
 */
const DECIMAL_WITH_ZEROS =
	/(?<![\p{L}\d.,_])(?<!\p{L}-)(?<!\/[ \t]*)(\d+)([.,])(\d*?)(0+)(?![\d.,]\d)(?!\d)(?![ \t]*\/)/gu;

function withoutTrailingZeros(text: string): string {
	return text.replace(
		DECIMAL_WITH_ZEROS,
		(match, n: string, sep: string, digits: string, zeros: string) => {
			if (sep === "," && digits.length + zeros.length === 3) return match;
			return digits ? `${n}${sep}${digits}` : n;
		},
	);
}

function normalizeText(text: string, isLast: boolean): string {
	// Rule 9 (tabs → 4 spaces) and rule 10 (trailing whitespace) rewrite prose.
	const out = text.replace(/\t/g, "    ").replace(/[ \t]+(?=\r?\n)/g, "");
	return isLast ? out.replace(/[ \t]+$/, "") : out;
}

export function normalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((v, i) =>
			typeof v === "string"
				? normalizeText(v, i === value.length - 1)
				: normalize(v),
		);
	}
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const [key, v] of Object.entries(record)) {
			if (POSITION_KEYS.has(key)) continue;
			// A number's source spelling (`160.0`): rule 4 drops trailing
			// zeros; `value` holds the number itself.
			if (key === "text" && "value" in record) continue;
			// A warning's message quotes the source spelling (`"180 °C"`);
			// its `code` and the rest of its fields are still compared.
			if (key === "message" && "code" in record) continue;
			// Rule 1 lowercases ingredient ids (`@Farine` → `@farine`), and
			// the displayed name follows the source's case.
			// The same goes for a composite's parent as written (`<@Flour`,
			// shown as is in a section's list: an id would show `citron-vert`)
			// and for the reference a warning quotes (`&@Flour`), which
			// follows the source's spelling like its `message` (#208).
			if (
				(key === "name" ||
					key === "parent" ||
					(key === "item" && "code" in record)) &&
				typeof v === "string"
			) {
				out[key] = v.toLowerCase();
				continue;
			}
			// Rule 1 again: the glued parent a SPACED_COMPOSITE suggests
			// (`<@Lemon`) quotes it as written, like `parent`. Today rule 6
			// glues every `<` kitchen flags, so I6 skips those inputs; this
			// keeps a blank kitchen would flag but rule 6 misses (a no-break
			// space before the fix) from reporting a case change as a change
			// of meaning. The same goes for the `@&Flour` a
			// REFERENCE_TO_INGREDIENT suggests for `&Flour`: it quotes the
			// name as written, like `item`.
			if (
				key === "data" &&
				(record.code === "SPACED_COMPOSITE" ||
					record.code === "REFERENCE_TO_INGREDIENT") &&
				v &&
				typeof v === "object" &&
				typeof (v as { suggestion?: unknown }).suggestion === "string"
			) {
				const data = v as { suggestion: string };
				out[key] = normalize({
					...data,
					suggestion: data.suggestion.toLowerCase(),
				});
				continue;
			}
			// Rule 4 drops a number's trailing decimal zeros (`1.30` → `1.3`),
			// and the duration an INVALID_DURATION suggests (`~{1.30% h}` →
			// `1.30 h`, since 1.6) quotes the source spelling, like its
			// `message`. Only those zeros are canonicalized: any other
			// difference in the suggestion still counts.
			if (
				key === "data" &&
				record.code === "INVALID_DURATION" &&
				v &&
				typeof v === "object" &&
				typeof (v as { suggestion?: unknown }).suggestion === "string"
			) {
				const data = v as { suggestion: string };
				out[key] = normalize({
					...data,
					suggestion: withoutTrailingZeros(data.suggestion),
				});
				continue;
			}
			out[key] = normalize(v);
		}
		return out;
	}
	return value;
}

/**
 * The path of the first difference between two normalized values, or null
 * when they are equal. Paths look like `$.sections[0].steps[2].text`.
 */
export function firstDifference(
	a: unknown,
	b: unknown,
	path = "$",
): string | null {
	if (Object.is(a, b)) return null;
	if (Array.isArray(a) && Array.isArray(b)) {
		const length = Math.max(a.length, b.length);
		for (let i = 0; i < length; i++) {
			const d = firstDifference(a[i], b[i], `${path}[${i}]`);
			if (d) return d;
		}
		return null;
	}
	if (
		a &&
		b &&
		typeof a === "object" &&
		typeof b === "object" &&
		!Array.isArray(a) &&
		!Array.isArray(b)
	) {
		const ra = a as Record<string, unknown>;
		const rb = b as Record<string, unknown>;
		const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
		for (const key of [...keys].sort()) {
			const d = firstDifference(ra[key], rb[key], `${path}.${key}`);
			if (d) return d;
		}
		return null;
	}
	return path;
}

/**
 * The coarse shape of a path, for signatures: indices blanked and only the
 * first segments kept (`$.sections[3].steps[0].text` → `$.sections[].steps[]`),
 * so one bug does not split into a signature per ingredient name or field.
 */
export function pathShape(path: string): string {
	const segments = path.replace(/\[\d+\]/g, "[]").split(".");
	// Frontmatter keys are the author's own words: stop at `$.meta`.
	const depth = segments[1] === "meta" ? 2 : 3;
	return segments.slice(0, depth).join(".");
}
