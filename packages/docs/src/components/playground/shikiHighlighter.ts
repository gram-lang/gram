import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

import gramGrammar from "@gram-lang/parser/textmate";

export const SHIKI_THEMES = {
	light: "github-light",
	dark: "github-dark",
} as const;

let highlighterPromise: Promise<HighlighterCore> | undefined;

// Shared singleton: the same highlighter instance backs both the
// CodeMirror editor (input) and the plain Shiki-to-HTML output views,
// so the grammar/theme setup only happens once per page load.
export function getHighlighter(): Promise<HighlighterCore> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighterCore({
			themes: [
				import("shiki/themes/github-light.mjs"),
				import("shiki/themes/github-dark.mjs"),
			],
			langs: [
				{ ...gramGrammar, name: "gram" } as any,
				import("shiki/langs/json.mjs"),
				import("shiki/langs/scheme.mjs"),
				import("shiki/langs/markdown.mjs"),
			],
			engine: createOnigurumaEngine(import("shiki/wasm")),
		});
	}
	return highlighterPromise;
}
