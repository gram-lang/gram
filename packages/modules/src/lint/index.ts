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
