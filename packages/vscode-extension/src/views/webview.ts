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
 *
 * Messages from the page: `{ type: "ready" }` once it can receive (sent again
 * whenever VS Code rebuilds a hidden panel), `{ type: "showError" }` from the
 * banner's button.
 */

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
		JSON.stringify({ outputEmpty: options.outputEmpty }),
	);
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
#banner {
	position: sticky; top: 0; z-index: 10;
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
<div id="banner" role="status" hidden>
	<span class="title"></span>
	<span class="message"></span>
	<button type="button">${escapeAttr(options.showError)}</button>
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
	window.addEventListener('message', (event) => {
		const message = event.data;
		if (message.type === 'content') show(message.content);
		else if (message.type === 'paused') pause(message.error);
		else if (message.type === 'showMacros') showMacros();
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
