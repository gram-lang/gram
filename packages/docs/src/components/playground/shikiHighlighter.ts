import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

import gramGrammar from "@gram-lang/parser/textmate";

export const SHIKI_THEMES = {
	light: "github-light",
	dark: "github-dark",
} as const;

// github-dark's comment token (#6a737d) only clears ~3:1 against our dark
// background, under the 4.5:1 text minimum. Swapping to the high-contrast
// theme variant fixed that but also recolors `entity.name` (ingredients)
// from purple to orange, breaking the purple used to match the HTML
// preview — so instead this patches just the comment rule's foreground,
// reusing github-dark-high-contrast's own comment color (AAA on our bg),
// and leaves every other scope from github-dark untouched.
const DARK_COMMENT_COLOR = "#bdc4cc";

async function accessibleGithubDark() {
	const { default: theme } = await import("shiki/themes/github-dark.mjs");
	return {
		...theme,
		tokenColors: theme.tokenColors?.map((rule) =>
			Array.isArray(rule.scope) && rule.scope.includes("comment")
				? {
						...rule,
						settings: { ...rule.settings, foreground: DARK_COMMENT_COLOR },
					}
				: rule,
		),
	};
}

let highlighterPromise: Promise<HighlighterCore> | undefined;

// Shared singleton: the same highlighter instance backs both the
// CodeMirror editor (input) and the plain Shiki-to-HTML output views,
// so the grammar/theme setup only happens once per page load.
export function getHighlighter(): Promise<HighlighterCore> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighterCore({
			themes: [import("shiki/themes/github-light.mjs"), accessibleGithubDark()],
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
