import { type CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { collectIngredients, collectIntermediates } from "../utils/ast-walker";
import type { IngredientDB } from "../ingredient-loader";
import { isInsideBraces, provideUnitCompletions } from "./completions-units";
import {
	isAfterAt,
	nameInsertion,
	provideIngredientCompletions,
} from "./completions-ingredients";
import type { ModuleHost } from "@gram-lang/modules";
import {
	matchUseBindingPrefix,
	matchUseSpecifierPrefix,
	provideImportExportCompletions,
	provideImportPathCompletions,
} from "./completions-imports";

// True when cursor follows a & used as a reference (&name), NOT a declaration (->&name).
function isAfterReference(prefix: string): boolean {
	const ampIdx = prefix.lastIndexOf("&");
	if (ampIdx === -1) return false;
	// If & is preceded by ->, it is a declaration — don't offer completions here.
	if (ampIdx >= 2 && prefix.slice(ampIdx - 2, ampIdx) === "->") return false;
	const after = prefix.slice(ampIdx + 1);
	return !after.includes("{") && !after.includes("\n");
}

/**
 * `prefix` (the line's text from its start up to the cursor) must come from
 * the *live* document, not `state.text` — `state` is only refreshed on a
 * 150ms debounce (see server.ts), so on the very keystroke that types the
 * trigger character (@/&), `state.text` doesn't contain it yet and every
 * prefix check below would silently fail (Phase 1.2). The AST (`state.ast`)
 * is fine to stay debounced; only the prefix needs to be fresh.
 */
export function provideCompletions(
	state: DocumentState,
	db: IngredientDB,
	prefix: string,
	uri = "",
	snippets = false,
	/** Reads the modules an `@use` line names, for its exports. */
	moduleHost?: ModuleHost,
): CompletionItem[] {
	// The `@use` line being typed does not parse yet (`state.ast` is null or
	// stale): both completions read the live prefix and the module itself.
	const useSpecifier = matchUseSpecifierPrefix(prefix);
	if (useSpecifier !== null) {
		return provideImportPathCompletions(useSpecifier, uri);
	}
	const useBinding = matchUseBindingPrefix(prefix);
	if (useBinding) {
		return provideImportExportCompletions(useBinding, uri, moduleHost);
	}

	if (!state.ast) return [];

	if (isInsideBraces(prefix)) {
		// The target of a share or a ratio (`{70% @&`, `{1 / 100 g &`): the
		// recipe's ingredients, or its intermediates, and no unit.
		const target = /(@&|&)\s*[^{}@&]*$/.exec(
			prefix.slice(prefix.lastIndexOf("{")),
		);
		if (target?.[1] === "@&") {
			const names = new Set(collectIngredients(state.ast).map((i) => i.name));
			return [...names].map((name) => ({
				label: name,
				kind: CompletionItemKind.Field,
			}));
		}
		if (target) return intermediateCompletions(state, false, snippets);
		return provideUnitCompletions(prefix);
	}

	// isAfterAt also matches optional modifiers: @?, @-, @*, @&, @=
	if (isAfterAt(prefix)) {
		return provideIngredientCompletions(db, snippets);
	}

	if (isAfterReference(prefix))
		return intermediateCompletions(state, true, snippets);

	return [];
}

/**
 * The intermediates the recipe declares. A reference with a multi-word name
 * needs braces (`&name{}`); a target inside braces does not.
 */
function intermediateCompletions(
	state: DocumentState,
	asReference: boolean,
	snippets: boolean,
): CompletionItem[] {
	if (!state.ast) return [];
	return collectIntermediates(state.ast).map(({ decl }) => ({
		label: decl.name,
		kind: CompletionItemKind.Variable,
		detail: `intermediate: ->&${decl.name}`,
		...(asReference
			? nameInsertion(decl.name, snippets)
			: { insertText: decl.name }),
	}));
}
