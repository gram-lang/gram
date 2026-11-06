/*
 * The page of a view panel, written once: its markup, with the words of its
 * controls. Its styles and its script are files of their own
 * (`webview/view.css`, `webview/view.ts`, bundled into `dist/webview/`),
 * loaded with the page's nonce; the messages it exchanges with the extension
 * are typed in `webview/messages.ts`.
 */

import type { ServingStrings, SessionStrings } from "./protocol";

export interface WebviewPageOptions {
	nonce: string;
	/** `webview.cspSource`. */
	cspSource: string;
	/** The renderer's stylesheet, the JSON tree's and the page's, as webview URIs. */
	styles: { preview: string; jsonTree: string; view: string };
	/** The page's script (`dist/webview/view.js`), as a webview URI. */
	script: string;
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
	const { nonce, cspSource, styles, script } = options;
	// Read by the page script (`PageStrings`), never interpolated into it as code.
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
<link href="${escapeAttr(styles.view)}" rel="stylesheet">
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
<script nonce="${nonce}" src="${escapeAttr(script)}"></script>
</body>
</html>`;
}
