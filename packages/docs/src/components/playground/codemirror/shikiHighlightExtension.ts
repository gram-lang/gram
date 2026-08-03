import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import type { HighlighterCore } from "shiki/core";

const decorationCache = new Map<string, Decoration>();

function decorationFor(
	color: string | undefined,
	fontStyle: number | undefined,
): Decoration {
	const key = `${color ?? ""}|${fontStyle ?? 0}`;
	let deco = decorationCache.get(key);
	if (!deco) {
		const styles: string[] = [];
		if (color) styles.push(`color:${color}`);
		if (fontStyle) {
			if (fontStyle & 1) styles.push("font-style:italic");
			if (fontStyle & 2) styles.push("font-weight:bold");
			if (fontStyle & 4) styles.push("text-decoration:underline");
		}
		deco = Decoration.mark({ attributes: { style: styles.join(";") } });
		decorationCache.set(key, deco);
	}
	return deco;
}

function buildDecorations(
	view: EditorView,
	highlighter: HighlighterCore,
	lang: string,
	theme: string,
): DecorationSet {
	const code = view.state.doc.toString();
	const builder = new RangeSetBuilder<Decoration>();
	const lines = highlighter.codeToTokensBase(code, { lang, theme });
	for (const line of lines) {
		for (const token of line) {
			if (!token.content) continue;
			const from = token.offset;
			const to = from + token.content.length;
			if (to <= from) continue;
			builder.add(from, to, decorationFor(token.color, token.fontStyle));
		}
	}
	return builder.finish();
}

// Feeds Shiki's own tokenizer (same grammars/themes used for the read-only
// output views) into CodeMirror as mark decorations, rather than pulling in
// a separate CM6 language mode for "gram" — there is no language service
// (autocomplete, folding, diagnostics-by-syntax) to justify one here.
export function shikiHighlightExtension(
	highlighter: HighlighterCore,
	lang: string,
	theme: string,
) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, highlighter, lang, theme);
			}
			update(update: ViewUpdate) {
				if (update.docChanged) {
					this.decorations = buildDecorations(
						update.view,
						highlighter,
						lang,
						theme,
					);
				}
			}
		},
		{ decorations: (v) => v.decorations },
	);
}
