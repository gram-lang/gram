/*
 * The page of a view panel, written once: the extension then sends it the
 * content and the paused state as messages, so a new edit never reloads the
 * page (no flash, the scroll position is kept).
 *
 * Messages to the page:
 * - `{ type: "content", content }`: replace what is shown.
 * - `{ type: "paused", error }`: dim the content under a banner, or, with
 *   `error: null`, show it normally again.
 * - `{ type: "showMacros" }`: scroll to the nutrition panel of the recipe.
 * - `{ type: "serving", serveAt }`: the serving time of the recipe, or `null`
 *   (a view laid out in time only).
 * - `{ type: "suggestions", data }`: the serving times to propose, or `null`.
 *
 * Messages from the page: `{ type: "ready" }` once it can receive (sent again
 * whenever VS Code rebuilds a hidden panel), `{ type: "showError" }` from the
 * banner's button, `{ type: "setServeAt", serveAt }` when the cook picks or
 * clears (`null`) a serving time, `{ type: "suggest", open }` when the
 * suggestions are shown or hidden.
 */

import type { ServingStrings } from "./protocol";

export interface WebviewPageOptions {
	nonce: string;
	/** `webview.cspSource`. */
	cspSource: string;
	/** The renderer's stylesheet and the JSON tree's, as webview URIs. */
	styles: { preview: string; jsonTree: string };
	title: string;
	/** The label of the banner's button. */
	showError: string;
	/** What an output the recipe has nothing for says. */
	outputEmpty: string;
	/** The words of the serving time controls: given for a view laid out in time only. */
	serving?: ServingStrings;
}

const escapeAttr = (text: string) =>
	text
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

export function webviewPage(options: WebviewPageOptions): string {
	const { nonce, cspSource, styles } = options;
	// Read by the page script, never interpolated into it as code.
	const strings = escapeAttr(
		JSON.stringify({
			outputEmpty: options.outputEmpty,
			...(options.serving && { serving: options.serving }),
		}),
	);
	const serving = options.serving;
	const servingBar = serving
		? `<div id="serving">
	<div class="serving-row">
		<label for="serve-at">${escapeAttr(serving.label)}</label>
		<input id="serve-at" type="datetime-local" step="300">
		<button type="button" id="serve-clear" class="secondary" title="${escapeAttr(serving.clearTitle)}" hidden>${escapeAttr(serving.clear)}</button>
	</div>
	<details id="serve-suggest">
		<summary>${escapeAttr(serving.suggest)}</summary>
		<div class="serve-pills" role="group"></div>
		<p class="serve-none" hidden>${escapeAttr(serving.none)}</p>
		<details class="serve-why" hidden><summary>${escapeAttr(serving.whyNot)}</summary><ul></ul></details>
	</details>
</div>`
		: "";
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src 'unsafe-inline' ${cspSource} https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}';">
<title>${escapeAttr(options.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link href="${escapeAttr(styles.preview)}" rel="stylesheet">
<link href="${escapeAttr(styles.jsonTree)}" rel="stylesheet">
<style nonce="${nonce}">
:root, body.vscode-light, body.vscode-dark, body.vscode-high-contrast {
	/* The renderer's colors, blended into the VS Code theme. */
	--color-bg: var(--vscode-editor-background);
	--color-bg-subtle: var(--vscode-editorWidget-background);
	--color-bg-muted: var(--vscode-editorWidget-background);
	--color-surface: var(--vscode-editorWidget-background);
	--color-surface-raised: var(--vscode-editorWidget-background);
	--color-border: var(--vscode-widget-border);
	--color-border-strong: var(--vscode-focusBorder);
	--color-text-muted: var(--vscode-descriptionForeground);
	--color-text: var(--vscode-editor-foreground);
	--color-text-strong: var(--vscode-editor-foreground);
	--gram-font-sans: 'Inter', var(--vscode-font-family);
	--gram-font-mono: var(--vscode-editor-font-family);
	/* The JSON tree of the inspectors. */
	--gram-json-font: var(--vscode-editor-font-family);
	--gram-json-key: var(--vscode-symbolIcon-propertyForeground, var(--vscode-textLink-foreground));
	--gram-json-string: var(--vscode-debugTokenExpression-string, var(--vscode-charts-green));
	--gram-json-punct: var(--vscode-descriptionForeground);
	--gram-json-muted: var(--vscode-descriptionForeground);
	--gram-json-guide: var(--vscode-tree-indentGuidesStroke, var(--vscode-widget-border));
	--gram-json-hover: var(--vscode-list-hoverBackground);
}
html, body { margin: 0; }
body { font-family: var(--gram-font-sans); color: var(--color-text-strong); }
#top { position: sticky; top: 0; z-index: 10; }
#banner {
	display: flex; align-items: center; gap: 12px;
	padding: 6px 12px;
	font-family: var(--vscode-font-family); font-size: var(--vscode-font-size, 13px);
	color: var(--vscode-editorWarning-foreground, var(--vscode-foreground));
	background: var(--vscode-inputValidation-warningBackground, var(--vscode-editorWidget-background));
	border-bottom: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-widget-border));
}
#banner[hidden] { display: none; }
#banner .title { font-weight: 600; }
#banner .message { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vscode-descriptionForeground); }
#banner button {
	font: inherit; padding: 2px 10px; cursor: pointer; border: none; border-radius: 2px;
	color: var(--vscode-button-foreground); background: var(--vscode-button-background);
}
#banner button:hover { background: var(--vscode-button-hoverBackground); }
#serving {
	padding: 6px 12px;
	font-family: var(--vscode-font-family); font-size: var(--vscode-font-size, 13px);
	color: var(--vscode-foreground);
	background: var(--vscode-editor-background);
	border-bottom: 1px solid var(--vscode-widget-border, transparent);
}
#serving .serving-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#serving label { color: var(--vscode-descriptionForeground); }
#serving input {
	font: inherit; padding: 2px 4px; border-radius: 2px;
	color: var(--vscode-input-foreground); background: var(--vscode-input-background);
	border: 1px solid var(--vscode-input-border, transparent);
	color-scheme: light dark;
}
#serving input:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
#serving button {
	font: inherit; padding: 2px 10px; cursor: pointer; border: none; border-radius: 2px;
	color: var(--vscode-button-foreground); background: var(--vscode-button-background);
}
#serving button:hover { background: var(--vscode-button-hoverBackground); }
#serving button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
#serving button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
#serving button[hidden], #serving [hidden] { display: none; }
#serving summary { cursor: pointer; margin-top: 4px; color: var(--vscode-textLink-foreground); width: fit-content; }
#serving summary:focus-visible { outline: 1px solid var(--vscode-focusBorder); }
.serve-pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }
.serve-pills button { border-radius: 10px; padding: 2px 10px; }
.serve-pills button.secondary[aria-pressed="true"], .serve-pills button[aria-pressed="true"] {
	outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px;
}
.serve-none { margin: 6px 0 2px; color: var(--vscode-descriptionForeground); }
.serve-why summary { color: var(--vscode-descriptionForeground); font-size: 0.95em; }
.serve-why ul { margin: 4px 0; padding-left: 18px; color: var(--vscode-descriptionForeground); }
body.paused #content { opacity: 0.45; pointer-events: none; transition: opacity 120ms; }
.gram-empty { padding: 24px 20px; color: var(--vscode-descriptionForeground); font-family: var(--vscode-font-family); }
.gram-code {
	margin: 0; padding: 12px 16px; white-space: pre; overflow: auto;
	font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size, 13px);
	color: var(--vscode-editor-foreground);
}
.gram-json-tree { padding: 12px 16px; color: var(--vscode-editor-foreground); font-size: var(--vscode-editor-font-size, 13px); }
</style>
</head>
<body data-strings="${strings}">
<div id="top">
<div id="banner" role="status" hidden>
	<span class="title"></span>
	<span class="message"></span>
	<button type="button">${escapeAttr(options.showError)}</button>
</div>
${servingBar}
</div>
<div id="content"></div>
<script nonce="${nonce}">
(function () {
	const vscode = acquireVsCodeApi();
	const strings = JSON.parse(document.body.dataset.strings);
	const content = document.getElementById('content');
	const banner = document.getElementById('banner');
	const showMacros = () => {
		document.body.classList.add('show-macros');
		const panel = document.querySelector('.nutrition-panel');
		if (panel) panel.scrollIntoView({ behavior: 'smooth' });
	};
	function show(next) {
		content.className = '';
		document.body.classList.toggle('gram-preview', next.type === 'html');
		if (next.type === 'html' || next.type === 'tree') {
			content.innerHTML = next.html;
		} else if (next.type === 'code') {
			const pre = document.createElement('pre');
			pre.className = 'gram-code';
			const code = document.createElement('code');
			if (next.language) code.dataset.language = next.language;
			code.textContent = next.text;
			pre.appendChild(code);
			content.replaceChildren(pre);
		} else {
			const p = document.createElement('p');
			p.className = 'gram-empty';
			p.textContent = strings.outputEmpty;
			content.replaceChildren(p);
		}
	}
	function pause(error) {
		document.body.classList.toggle('paused', !!error);
		banner.hidden = !error;
		if (!error) return;
		banner.querySelector('.title').textContent = error.title;
		const message = banner.querySelector('.message');
		message.textContent = error.message;
		message.title = error.description + '\\n\\n' + error.message;
	}
	const servingBar = document.getElementById('serving');
	let serveAt = null;
	function setServing(value) {
		serveAt = value;
		if (!servingBar) return;
		const input = servingBar.querySelector('#serve-at');
		if (document.activeElement !== input) input.value = value || '';
		servingBar.querySelector('#serve-clear').hidden = !value;
		for (const pill of servingBar.querySelectorAll('.serve-pills button')) {
			pill.setAttribute('aria-pressed', String(pill.dataset.serveAt === value));
		}
	}
	function pill(serveAt, label, title, primary) {
		const button = document.createElement('button');
		button.type = 'button';
		if (!primary) button.className = 'secondary';
		button.dataset.serveAt = serveAt;
		button.textContent = label;
		button.title = title;
		return button;
	}
	function showSuggestions(data) {
		if (!servingBar) return;
		const pills = servingBar.querySelector('.serve-pills');
		const none = servingBar.querySelector('.serve-none');
		const why = servingBar.querySelector('.serve-why');
		const s = strings.serving;
		const children = [];
		if (data && data.earliest) {
			const e = data.earliest;
			const match = data.candidates.find((c) => c.serveAt === e.serveAt);
			children.push(pill(e.serveAt, s.earliest.replace('{when}', e.label),
				match && match.title ? e.text + '\\n• ' + match.title : e.text, true));
		}
		for (const c of data ? data.candidates : []) {
			if (data.earliest && c.serveAt === data.earliest.serveAt) continue;
			children.push(pill(c.serveAt, c.label, c.title, false));
		}
		pills.replaceChildren(...children);
		none.hidden = !data || children.length > 0;
		const rejected = data ? data.rejected : [];
		why.hidden = rejected.length === 0;
		why.querySelector('ul').replaceChildren(...rejected.map((line) => {
			const li = document.createElement('li');
			li.textContent = line;
			return li;
		}));
		setServing(serveAt);
	}
	if (servingBar) {
		const input = servingBar.querySelector('#serve-at');
		input.addEventListener('change', () => {
			vscode.postMessage({ type: 'setServeAt', serveAt: input.value || null });
		});
		servingBar.querySelector('#serve-clear').addEventListener('click', () => {
			vscode.postMessage({ type: 'setServeAt', serveAt: null });
		});
		servingBar.querySelector('.serve-pills').addEventListener('click', (event) => {
			const button = event.target.closest('button');
			if (button) vscode.postMessage({ type: 'setServeAt', serveAt: button.dataset.serveAt });
		});
		const suggest = servingBar.querySelector('#serve-suggest');
		suggest.addEventListener('toggle', () => {
			vscode.postMessage({ type: 'suggest', open: suggest.open });
		});
	}
	window.addEventListener('message', (event) => {
		const message = event.data;
		if (message.type === 'content') show(message.content);
		else if (message.type === 'paused') pause(message.error);
		else if (message.type === 'showMacros') showMacros();
		else if (message.type === 'serving') setServing(message.serveAt);
		else if (message.type === 'suggestions') showSuggestions(message.data);
	});
	banner.querySelector('button').addEventListener('click', () => {
		vscode.postMessage({ type: 'showError' });
	});
	vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
