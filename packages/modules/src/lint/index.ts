/**
 * `@gram-lang/modules/lint`: the writing checks shared by the language server
 * and the CLI.
 *
 * @experimental Every export of this entry point may still change in a minor
 * release. It is deliberately not re-exported from `@gram-lang/modules`, so
 * consumers of the main entry (the docs playground among them) do not bundle it.
 */
export {
	findUnquantifiedIngredients,
	findWrittenIngredients,
	lostFrom,
	unquantifiedFrom,
	type WrittenIngredient,
} from "./gram-tokens";
export type {
	FileEdit,
	LintDiagnostic,
	LintFix,
	LintRelated,
	LintSeverity,
	TextPatch,
} from "./types";
export {
	allDiagnosticInfo,
	DIAGNOSTICS_DOC_BASE,
	type DiagnosticInfo,
	diagnosticInfoOf,
	docUrlOf,
	LINT_RULES,
	type LintRuleCode,
	type LintRuleInfo,
} from "./registry";
export {
	type LintConfig,
	type LintRuleSetting,
	parseLintConfig,
} from "./config";
export { type AppliedFix, applyPreferredFixes } from "./apply-fixes";
export {
	EDITOR_HIDDEN_CODES,
	type LintInput,
	lintDocument,
} from "./lint-document";
export {
	buildLineIndex,
	type LinePosition,
	offsetToPosition,
} from "./position";
export type { LintIngredientDB } from "./rules";
export type { LintIngredientsFile } from "./ingredients-file";
export {
	collectIngredients,
	collectIntermediates,
	collectReferences,
	collectRelativeTargets,
	collectTimers,
	findNameAtOffset,
	getStepSourceText,
	type IntermediateDeclWithSection,
	type RelativeTarget,
} from "./ast-walker";
export {
	type FrontmatterBlock,
	type FrontmatterKeyLine,
	frontmatterKeyAt,
	isFrontmatterLine,
	scanFrontmatter,
} from "./frontmatter-text";
