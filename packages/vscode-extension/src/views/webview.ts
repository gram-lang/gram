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
 * - `{ type: "session", session }`: what the cook chose for the recipe this
 *   sitting (serving time, scale, stock, baker's reference).
 * - `{ type: "suggestions", data }`: the serving times to propose, or `null`
 *   (a view laid out in time only).
 * - `{ type: "choices", data }`: what the session controls offer (the
 *   ingredients, the imports, baker's math), or `null`.
 *
 * Messages from the page: `{ type: "ready" }` once it can receive (sent again
 * whenever VS Code rebuilds a hidden panel), `{ type: "showError" }` from the
 * banner's button, `{ type: "setSession", patch }` when the cook changes a
 * part of the session (`null` clears it), `{ type: "suggest", open }` and
 * `{ type: "choose", open }` when the suggestions or the session controls are
 * shown or hidden.
 */

import type { ServingStrings, SessionStrings } from "./protocol";

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
	/** The words of the session controls: given for a view of the recipe only. */
	session?: SessionStrings;
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
			...(options.session && { session: options.session }),
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
	const session = options.session;
	const sessionBlock = session
		? `<details id="session">
	<summary>${escapeAttr(session.title)} <span class="session-summary"></span></summary>
	<div class="session-body">
		<p class="session-error" hidden></p>
		<div class="session-row">
			<label for="scale-factor">${escapeAttr(session.scale)}</label>
			<input id="scale-factor" type="number" min="1" step="any" placeholder="100"> %
		</div>
		<div class="session-row">
			<label for="scale-target">${escapeAttr(session.byIngredient)}</label>
			<select id="scale-target"><option value="">${escapeAttr(session.ingredient)}</option></select>
			<input id="scale-qty" type="number" min="0" step="any" placeholder="${escapeAttr(session.qty)}" aria-label="${escapeAttr(session.qty)}">
			<input id="scale-unit" type="text" size="5" placeholder="${escapeAttr(session.unit)}" aria-label="${escapeAttr(session.unit)}">
			<button type="button" id="scale-apply">${escapeAttr(session.apply)}</button>
		</div>
		<div class="session-row" id="bakers-row" hidden>
			<label for="bakers-ref">${escapeAttr(session.bakersReference)}</label>
			<select id="bakers-ref"><option value="">${escapeAttr(session.auto)}</option></select>
		</div>
		<fieldset id="stock" hidden>
			<legend title="${escapeAttr(session.stockHint)}">${escapeAttr(session.stock)}</legend>
		</fieldset>
		<button type="button" id="session-reset" class="secondary">${escapeAttr(session.reset)}</button>
	</div>
</details>`
		: "";
	const controls =
		servingBar || sessionBlock
			? `<div id="controls">${servingBar}${sessionBlock}</div>`
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
#controls {
	padding: 6px 12px;
	font-family: var(--vscode-font-family); font-size: var(--vscode-font-size, 13px);
	color: var(--vscode-foreground);
	background: var(--vscode-editor-background);
	border-bottom: 1px solid var(--vscode-widget-border, transparent);
}
#controls .serving-row, #controls .session-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#controls label { color: var(--vscode-descriptionForeground); }
#controls input {
	font: inherit; padding: 2px 4px; border-radius: 2px;
	color: var(--vscode-input-foreground); background: var(--vscode-input-background);
	border: 1px solid var(--vscode-input-border, transparent);
	color-scheme: light dark;
}
#controls input:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
#controls button {
	font: inherit; padding: 2px 10px; cursor: pointer; border: none; border-radius: 2px;
	color: var(--vscode-button-foreground); background: var(--vscode-button-background);
}
#controls button:hover { background: var(--vscode-button-hoverBackground); }
#controls button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
#controls button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
#controls button[hidden], #controls [hidden] { display: none; }
#controls summary { cursor: pointer; margin-top: 4px; color: var(--vscode-textLink-foreground); width: fit-content; }
#controls summary:focus-visible { outline: 1px solid var(--vscode-focusBorder); }
.serve-pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }
.serve-pills button { border-radius: 10px; padding: 2px 10px; }
.serve-pills button.secondary[aria-pressed="true"], .serve-pills button[aria-pressed="true"] {
	outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px;
}
.serve-none { margin: 6px 0 2px; color: var(--vscode-descriptionForeground); }
.serve-why summary { color: var(--vscode-descriptionForeground); font-size: 0.95em; }
.serve-why ul { margin: 4px 0; padding-left: 18px; color: var(--vscode-descriptionForeground); }
#controls select {
	font: inherit; padding: 2px 4px; border-radius: 2px;
	color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-dropdown-border, transparent);
}
#controls select:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
#controls #scale-factor { width: 6em; }
#controls #scale-qty { width: 6em; }
.session-body { max-height: 45vh; overflow: auto; display: flex; flex-direction: column; gap: 6px; padding: 6px 0 2px; }
.session-body > button { align-self: flex-start; }
.session-summary { color: var(--vscode-descriptionForeground); }
.session-error { margin: 0; color: var(--vscode-editorWarning-foreground, var(--vscode-foreground)); }
#stock { margin: 0; padding: 4px 8px; border: 1px solid var(--vscode-widget-border, transparent); border-radius: 2px; }
#stock legend { color: var(--vscode-descriptionForeground); padding: 0 4px; }
#stock label { display: flex; gap: 6px; align-items: center; color: var(--vscode-foreground); font-family: var(--vscode-editor-font-family); }
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
${controls}
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
			vscode.postMessage({ type: 'setSession', patch: { serveAt: input.value || null } });
		});
		servingBar.querySelector('#serve-clear').addEventListener('click', () => {
			vscode.postMessage({ type: 'setSession', patch: { serveAt: null } });
		});
		servingBar.querySelector('.serve-pills').addEventListener('click', (event) => {
			const button = event.target.closest('button');
			if (button) vscode.postMessage({ type: 'setSession', patch: { serveAt: button.dataset.serveAt } });
		});
		const suggest = servingBar.querySelector('#serve-suggest');
		suggest.addEventListener('toggle', () => {
			vscode.postMessage({ type: 'suggest', open: suggest.open });
		});
	}
	const sessionBlock = document.getElementById('session');
	let current = {};
	let choices = null;
	const fill = (template, values) =>
		template.replace(/\\{(\\w+)\\}/g, (_, k) => (k in values ? values[k] : '{' + k + '}'));
	function option(value, label) {
		const o = document.createElement('option');
		o.value = value;
		o.textContent = label;
		return o;
	}
	function setSession(session) {
		current = session || {};
		setServing(current.serveAt || null);
		if (!sessionBlock) return;
		const s = strings.session;
		const scale = current.scale;
		const factor = sessionBlock.querySelector('#scale-factor');
		if (document.activeElement !== factor) {
			factor.value = scale && scale.type === 'factor'
				? String(Math.round(scale.value * 10000) / 100) : '';
		}
		const target = sessionBlock.querySelector('#scale-target');
		if (scale && scale.type === 'target') {
			target.value = scale.id;
			sessionBlock.querySelector('#scale-qty').value = String(scale.qty);
			sessionBlock.querySelector('#scale-unit').value = scale.unit || '';
		}
		sessionBlock.querySelector('#bakers-ref').value = current.bakersReference || '';
		const stocked = new Set(current.stock || []);
		for (const box of sessionBlock.querySelectorAll('#stock input')) {
			box.checked = stocked.has(box.value);
		}
		const parts = [];
		if (scale && scale.type === 'factor') {
			parts.push(fill(s.scaled, { factor: String(Math.round(scale.value * 10000) / 100) }));
		} else if (scale && scale.type === 'target') {
			const item = choices && choices.ingredients.find((i) => i.id === scale.id);
			parts.push(scale.qty + (scale.unit ? ' ' + scale.unit : '') + ' ' + (item ? item.name : scale.id));
		}
		if (current.bakersReference) parts.push(s.bakersReference + ' : ' + current.bakersReference);
		if (stocked.size > 0) parts.push(fill(s.inStock, { n: String(stocked.size) }));
		sessionBlock.querySelector('.session-summary').textContent = parts.length ? '· ' + parts.join(' · ') : '';
	}
	function showChoices(data) {
		choices = data;
		if (!sessionBlock) return;
		const s = strings.session;
		const ingredients = data ? data.ingredients : [];
		const target = sessionBlock.querySelector('#scale-target');
		target.replaceChildren(option('', s.ingredient),
			...ingredients.map((i) => option(i.id, i.name)));
		const bakers = sessionBlock.querySelector('#bakers-ref');
		bakers.replaceChildren(option('', s.auto),
			...ingredients.map((i) => option(i.id, i.name)));
		sessionBlock.querySelector('#bakers-row').hidden = !(data && data.bakersMath);
		const stock = sessionBlock.querySelector('#stock');
		const legend = stock.querySelector('legend');
		const imports = data ? data.imports : [];
		stock.replaceChildren(legend, ...imports.map((imp) => {
			const label = document.createElement('label');
			const box = document.createElement('input');
			box.type = 'checkbox';
			box.value = imp.uri;
			label.append(box, document.createTextNode(imp.specifier));
			return label;
		}));
		stock.hidden = imports.length === 0;
		const error = sessionBlock.querySelector('.session-error');
		error.hidden = !(data && data.scaleError);
		error.textContent = data && data.scaleError ? fill(s.scaleError, { reason: data.scaleError }) : '';
		setSession(current);
	}
	if (sessionBlock) {
		const post = (patch) => vscode.postMessage({ type: 'setSession', patch });
		const factor = sessionBlock.querySelector('#scale-factor');
		factor.addEventListener('change', () => {
			const value = Number(factor.value);
			post({ scale: factor.value === '' || !(value > 0) ? null : { type: 'factor', value: value / 100 } });
		});
		const target = sessionBlock.querySelector('#scale-target');
		target.addEventListener('change', () => {
			const item = choices && choices.ingredients.find((i) => i.id === target.value);
			sessionBlock.querySelector('#scale-qty').value = item && item.qty !== undefined ? String(item.qty) : '';
			sessionBlock.querySelector('#scale-unit').value = item && item.unit ? item.unit : '';
		});
		const apply = () => {
			const qty = Number(sessionBlock.querySelector('#scale-qty').value);
			if (!target.value || !(qty > 0)) return;
			post({ scale: { type: 'target', id: target.value, qty,
				unit: sessionBlock.querySelector('#scale-unit').value.trim() || null } });
		};
		sessionBlock.querySelector('#scale-apply').addEventListener('click', apply);
		for (const id of ['#scale-qty', '#scale-unit']) {
			sessionBlock.querySelector(id).addEventListener('keydown', (event) => {
				if (event.key === 'Enter') apply();
			});
		}
		sessionBlock.querySelector('#bakers-ref').addEventListener('change', (event) => {
			post({ bakersReference: event.target.value || null });
		});
		sessionBlock.querySelector('#stock').addEventListener('change', () => {
			const uris = [...sessionBlock.querySelectorAll('#stock input:checked')].map((b) => b.value);
			post({ stock: uris.length ? uris : null });
		});
		sessionBlock.querySelector('#session-reset').addEventListener('click', () => {
			target.value = '';
			sessionBlock.querySelector('#scale-qty').value = '';
			sessionBlock.querySelector('#scale-unit').value = '';
			post({ scale: null, stock: null, bakersReference: null });
		});
		sessionBlock.addEventListener('toggle', () => {
			vscode.postMessage({ type: 'choose', open: sessionBlock.open });
		});
	}
	window.addEventListener('message', (event) => {
		const message = event.data;
		if (message.type === 'content') show(message.content);
		else if (message.type === 'paused') pause(message.error);
		else if (message.type === 'showMacros') showMacros();
		else if (message.type === 'session') setSession(message.session);
		else if (message.type === 'suggestions') showSuggestions(message.data);
		else if (message.type === 'choices') showChoices(message.data);
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
