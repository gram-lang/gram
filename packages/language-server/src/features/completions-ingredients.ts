import {
	type CompletionItem,
	CompletionItemKind,
	InsertTextFormat,
	MarkupKind,
} from "vscode-languageserver";
import {
	type IngredientDB,
	allIngredientCompletionLabels,
} from "../ingredient-loader";

export function isAfterAt(prefix: string): boolean {
	const atIdx = prefix.lastIndexOf("@");
	if (atIdx === -1) return false;
	// No newline or { between @ and cursor
	const after = prefix.slice(atIdx + 1);
	return !after.includes("{") && !after.includes("\n");
}

/**
 * The text that completes a name. A multi-word name needs braces to end it
 * (`@wheat flour{}`, `&pizza dough{}`): a client that expands snippets gets
 * the cursor between them, ready for the quantity; any other gets them as
 * plain text, the cursor after.
 */
export function nameInsertion(
	name: string,
	snippets: boolean,
): Pick<CompletionItem, "insertText" | "insertTextFormat"> {
	if (!name.includes(" ")) return { insertText: name };
	if (!snippets) return { insertText: `${name}{}` };
	return {
		insertText: `${name.replace(/[\\$}]/g, "\\$&")}{$0}`,
		insertTextFormat: InsertTextFormat.Snippet,
	};
}

export function provideIngredientCompletions(
	db: IngredientDB,
	snippets = false,
): CompletionItem[] {
	if (Object.keys(db).length === 0) return [];

	return allIngredientCompletionLabels(db).map(
		({ label, canonical, entry }) => {
			const lines: string[] = [];
			if (entry.name !== label) lines.push(`_${entry.name}_`);
			if (entry.nutrition) {
				const n = entry.nutrition;
				lines.push(
					`${n.calories} kcal/100g · P: ${n.protein}g · C: ${n.carbs}g · F: ${n.fat}g`,
				);
			}
			return {
				label,
				kind: CompletionItemKind.Value,
				detail: canonical !== label ? canonical : undefined,
				documentation:
					lines.length > 0
						? { kind: MarkupKind.Markdown, value: lines.join("\n\n") }
						: undefined,
				...nameInsertion(label, snippets),
			};
		},
	);
}
