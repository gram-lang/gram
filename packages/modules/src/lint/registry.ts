import { allWarningInfo } from "../warnings";
import type { LintSeverity } from "./types";

/**
 * A code of the lint layer: one the compiler never raises, found by
 * `lintDocument` itself in the AST or the text.
 *
 * @experimental Part of `@gram-lang/modules/lint`, whose shape may still
 * change in a minor release.
 */
export interface LintRuleInfo {
	code: string;
	defaultSeverity: LintSeverity;
	/** The shape of its message, placeholders in braces, as the docs table shows it. */
	summary: string;
}

/**
 * The codes of the lint layer.
 *
 * @experimental
 */
export const LINT_RULES = [
	{
		code: "PARSE_ERROR",
		defaultSeverity: "error",
		summary: "{message}",
	},
	{
		code: "COMPILE_ERROR",
		defaultSeverity: "error",
		summary: "{message}",
	},
	{
		code: "MISSING_TITLE",
		defaultSeverity: "warning",
		summary: "Recipe is missing a 'title' in frontmatter.",
	},
	{
		code: "UNUSED_INTERMEDIATE",
		defaultSeverity: "warning",
		summary: "Intermediate '->&{name}' is declared but never used.",
	},
	{
		code: "UNKNOWN_INGREDIENT",
		defaultSeverity: "info",
		summary:
			"'@{name}' not found in the ingredient database. Did you mean '@{suggestion}'?",
	},
	{
		code: "LOST_INGREDIENT",
		defaultSeverity: "warning",
		summary:
			"'@{name}' is written but not read as an ingredient: the '//' before it on this line starts a comment.",
	},
	{
		code: "MERGED_STEP_LINE",
		defaultSeverity: "info",
		summary:
			"This line is read as text of the step above: leave a blank line before it.",
	},
	{
		code: "SUSPECT_INGREDIENT_NAME",
		defaultSeverity: "hint",
		summary:
			"'{name}' reads more like a sentence than an ingredient name: a preparation may belong in parentheses after the quantity.",
	},
	{
		code: "UNREAD_FRONTMATTER",
		defaultSeverity: "warning",
		summary:
			"The frontmatter is not read: a '#' or indented line is not a 'key: value' line, so the whole block is taken as the text of a step.",
	},
] as const satisfies readonly LintRuleInfo[];

/**
 * A code of the lint layer, typed.
 *
 * @experimental
 */
export type LintRuleCode = (typeof LINT_RULES)[number]["code"];

/**
 * What a tool needs to know of any code `lintDocument` can return.
 *
 * @experimental
 */
export interface DiagnosticInfo {
	code: string;
	severity: LintSeverity;
	/** The code flags a deprecated form. */
	deprecated?: true;
	/** `compiler`: a `Warning` of kitchen, the analyzer or modules; `lint`: a rule of this layer. */
	origin: "compiler" | "lint";
	/** The shape of its message, placeholders in braces (`{name}`). */
	summary: string;
}

/** The page every code has its section on, under its own anchor. */
export const DIAGNOSTICS_DOC_BASE =
	"https://gram-lang.org/docs/reference/api/warnings/";

/**
 * The address of a code's section on the warnings reference page: its anchor
 * is the code in lower case, as the page's `### \`CODE\`` heading gets it.
 *
 * @experimental
 */
export function docUrlOf(code: string): string {
	return `${DIAGNOSTICS_DOC_BASE}#${code.toLowerCase()}`;
}

// A compiler template rendered with a stand-in payload, so the summary shows
// the message's shape ("Variable '{targetName}' not found.").
const payloadProxy = new Proxy(
	{},
	{ get: (_t, prop) => `{${String(prop)}}` },
) as never;

let cache: DiagnosticInfo[] | null = null;

/**
 * Every code `lintDocument` can return: the compiler's (kitchen, the analyzer,
 * modules), then the lint layer's. The single source of the warnings
 * reference table and of each diagnostic's `docUrl`.
 *
 * @experimental
 */
export function allDiagnosticInfo(): DiagnosticInfo[] {
	cache ??= [
		...allWarningInfo.map(
			({ code, severity, deprecated, template }): DiagnosticInfo => ({
				code,
				severity,
				...(deprecated ? { deprecated } : {}),
				origin: "compiler",
				summary: template(payloadProxy),
			}),
		),
		...LINT_RULES.map(
			(rule): DiagnosticInfo => ({
				code: rule.code,
				severity: rule.defaultSeverity,
				origin: "lint",
				summary: rule.summary,
			}),
		),
	];
	return cache;
}

/**
 * The info of one code; a code of no registry reads as a `warning`.
 *
 * @experimental
 */
export function diagnosticInfoOf(code: string): DiagnosticInfo {
	return (
		allDiagnosticInfo().find((info) => info.code === code) ?? {
			code,
			severity: "warning",
			origin: "compiler",
			summary: "",
		}
	);
}
