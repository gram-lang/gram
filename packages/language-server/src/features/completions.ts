import { type CompletionItem, CompletionItemKind } from "vscode-languageserver";
import type { DocumentState } from "../document-state";
import { collectIntermediates } from "../utils/ast-walker";
import type { IngredientDB } from "../ingredient-loader";
import { isInsideBraces, provideUnitCompletions } from "./completions-units";
import {
	isAfterAt,
	provideIngredientCompletions,
} from "./completions-ingredients";

// True when cursor follows a & used as a reference (&name), NOT a declaration (->&name).
function isAfterReference(prefix: string): boolean {
	const ampIdx = prefix.lastIndexOf("&");
	if (ampIdx === -1) return false;
	// If & is preceded by ->, it is a declaration — don't offer completions here.
	if (ampIdx >= 2 && prefix.slice(ampIdx - 2, ampIdx) === "->") return false;
	// Ensure there is no { or newline between & and cursor (not inside braces or new line).
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
): CompletionItem[] {
	if (!state.ast) return [];

	// Inside {quantity unit} → unit completions
	if (isInsideBraces(prefix)) {
		return provideUnitCompletions(prefix);
	}

	// After @ (with optional modifier: @?, @-, @*, @&, @=) → ingredient completions
	if (isAfterAt(prefix)) {
		return provideIngredientCompletions(db);
	}

	// After &name (reference, not declaration) → intermediate completions
	if (isAfterReference(prefix)) {
		return collectIntermediates(state.ast).map(({ decl }) => ({
			label: decl.name,
			kind: CompletionItemKind.Variable,
			detail: `intermediate: ->&${decl.name}`,
			// Multi-word names require {} in the reference syntax (&name{})
			insertText: decl.name.includes(" ") ? `${decl.name}{}` : decl.name,
		}));
	}

	return [];
}
