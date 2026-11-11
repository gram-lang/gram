/*
 * The script of a view panel's page, bundled on its own (`dist/webview/view.js`)
 * and loaded with the page's nonce. The page is written once
 * (`views/webview.ts`); the extension then sends it the content, the paused
 * state and the session as messages (`messages.ts`), so a new edit never
 * reloads it (no flash, the scroll position is kept).
 */

import { attachTooltips } from "@gram-lang/renderer";
import type {
	Content,
	PausedError,
	ServeSuggestions,
	Session,
	SessionChoices,
	SessionPatch,
} from "../views/protocol";
import { fill, percentOf, sessionSummary } from "./format";
import type { FromPage, PageStrings, ToPage } from "./messages";

declare function acquireVsCodeApi(): { postMessage(message: FromPage): void };

const vscode = acquireVsCodeApi();
const strings = JSON.parse(
	document.body.dataset.strings ?? "{}",
) as PageStrings;

/** The element of `selector` in `root`, which the page always has. */
function el<T extends Element = HTMLElement>(
	root: ParentNode,
	selector: string,
): T {
	const found = root.querySelector<T>(selector);
	if (!found) throw new Error(`The page has no ${selector}`);
	return found;
}

const content = el(document, "#content");
attachTooltips(content);
const banner = el(document, "#banner");

function showMacros(): void {
	document.body.classList.add("show-macros");
	document
		.querySelector(".nutrition-panel")
		?.scrollIntoView({ behavior: "smooth" });
}

function show(next: Content): void {
	content.className = "";
	document.body.classList.toggle("gram-preview", next.type === "html");
	if (next.type === "html" || next.type === "tree") {
		content.innerHTML = next.html;
	} else if (next.type === "code") {
		const pre = document.createElement("pre");
		pre.className = "gram-code";
		const code = document.createElement("code");
		if (next.language) code.dataset.language = next.language;
		code.textContent = next.text;
		pre.appendChild(code);
		content.replaceChildren(pre);
	} else {
		const p = document.createElement("p");
		p.className = "gram-empty";
		p.textContent = strings.outputEmpty;
		content.replaceChildren(p);
	}
}

function pause(error: PausedError | null): void {
	document.body.classList.toggle("paused", Boolean(error));
	banner.hidden = !error;
	if (!error) return;
	el(banner, ".title").textContent = error.title;
	const message = el(banner, ".message");
	message.textContent = error.message;
	message.title = `${error.description}\n\n${error.message}`;
}

// The serving time of a view laid out in time.

const servingBar = document.getElementById("serving");
let serveAt: string | null = null;

function setServing(value: string | null): void {
	serveAt = value;
	if (!servingBar) return;
	const input = el<HTMLInputElement>(servingBar, "#serve-at");
	if (document.activeElement !== input) input.value = value ?? "";
	el(servingBar, "#serve-clear").hidden = !value;
	for (const pill of servingBar.querySelectorAll<HTMLButtonElement>(
		".serve-pills button",
	)) {
		pill.setAttribute("aria-pressed", String(pill.dataset.serveAt === value));
	}
}

function pill(
	when: string,
	label: string,
	title: string,
	primary: boolean,
): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	if (!primary) button.className = "secondary";
	button.dataset.serveAt = when;
	button.textContent = label;
	button.title = title;
	return button;
}

function showSuggestions(data: ServeSuggestions | null): void {
	const s = strings.serving;
	if (!servingBar || !s) return;
	const children: HTMLButtonElement[] = [];
	const earliest = data?.earliest;
	if (earliest) {
		const match = data?.candidates.find((c) => c.serveAt === earliest.serveAt);
		children.push(
			pill(
				earliest.serveAt,
				fill(s.earliest, { when: earliest.label }),
				match?.title ? `${earliest.text}\n• ${match.title}` : earliest.text,
				true,
			),
		);
	}
	for (const c of data?.candidates ?? []) {
		if (c.serveAt === earliest?.serveAt) continue;
		children.push(pill(c.serveAt, c.label, c.title, false));
	}
	el(servingBar, ".serve-pills").replaceChildren(...children);
	el(servingBar, ".serve-none").hidden = !data || children.length > 0;
	const rejected = data?.rejected ?? [];
	const why = el(servingBar, ".serve-why");
	why.hidden = rejected.length === 0;
	el(why, "ul").replaceChildren(
		...rejected.map((line) => {
			const li = document.createElement("li");
			li.textContent = line;
			return li;
		}),
	);
	setServing(serveAt);
}

if (servingBar) {
	const input = el<HTMLInputElement>(servingBar, "#serve-at");
	input.addEventListener("change", () => {
		vscode.postMessage({
			type: "setSession",
			patch: { serveAt: input.value || null },
		});
	});
	el(servingBar, "#serve-clear").addEventListener("click", () => {
		vscode.postMessage({ type: "setSession", patch: { serveAt: null } });
	});
	el(servingBar, ".serve-pills").addEventListener("click", (event) => {
		const button = (event.target as Element).closest<HTMLButtonElement>(
			"button",
		);
		if (button?.dataset.serveAt) {
			vscode.postMessage({
				type: "setSession",
				patch: { serveAt: button.dataset.serveAt },
			});
		}
	});
	const suggest = el<HTMLDetailsElement>(servingBar, "#serve-suggest");
	suggest.addEventListener("toggle", () => {
		vscode.postMessage({ type: "suggest", open: suggest.open });
	});
}

// The session of a view of the recipe: scale, baker's reference, stock.

const sessionBlock = document.getElementById(
	"session",
) as HTMLDetailsElement | null;
let current: Session = {};
let choices: SessionChoices | null = null;

function option(value: string, label: string): HTMLOptionElement {
	const o = document.createElement("option");
	o.value = value;
	o.textContent = label;
	return o;
}

function setSession(session: Session): void {
	current = session;
	setServing(current.serveAt ?? null);
	const s = strings.session;
	if (!sessionBlock || !s) return;
	const scale = current.scale;
	const factor = el<HTMLInputElement>(sessionBlock, "#scale-factor");
	if (document.activeElement !== factor) {
		factor.value = scale?.type === "factor" ? percentOf(scale.value) : "";
	}
	if (scale?.type === "target") {
		el<HTMLSelectElement>(sessionBlock, "#scale-target").value = scale.id;
		el<HTMLInputElement>(sessionBlock, "#scale-qty").value = String(scale.qty);
		el<HTMLInputElement>(sessionBlock, "#scale-unit").value = scale.unit ?? "";
	}
	el<HTMLSelectElement>(sessionBlock, "#bakers-ref").value =
		current.bakersReference ?? "";
	const stocked = new Set(current.stock ?? []);
	for (const box of sessionBlock.querySelectorAll<HTMLInputElement>(
		"#stock input",
	)) {
		box.checked = stocked.has(box.value);
	}
	el(sessionBlock, ".session-summary").textContent = sessionSummary(
		current,
		choices,
		s,
	);
}

function showChoices(data: SessionChoices | null): void {
	choices = data;
	const s = strings.session;
	if (!sessionBlock || !s) return;
	const ingredients = data?.ingredients ?? [];
	el(sessionBlock, "#scale-target").replaceChildren(
		option("", s.ingredient),
		...ingredients.map((i) => option(i.id, i.name)),
	);
	el(sessionBlock, "#bakers-ref").replaceChildren(
		option("", s.auto),
		...ingredients.map((i) => option(i.id, i.name)),
	);
	el(sessionBlock, "#bakers-row").hidden = !data?.bakersMath;
	const stock = el(sessionBlock, "#stock");
	const legend = el(stock, "legend");
	const imports = data?.imports ?? [];
	stock.replaceChildren(
		legend,
		...imports.map((imp) => {
			const label = document.createElement("label");
			const box = document.createElement("input");
			box.type = "checkbox";
			box.value = imp.uri;
			label.append(box, document.createTextNode(imp.specifier));
			return label;
		}),
	);
	stock.hidden = imports.length === 0;
	const error = el(sessionBlock, ".session-error");
	error.hidden = !data?.scaleError;
	error.textContent = data?.scaleError
		? fill(s.scaleError, { reason: data.scaleError })
		: "";
	setSession(current);
}

if (sessionBlock) {
	const block = sessionBlock;
	const post = (patch: SessionPatch) =>
		vscode.postMessage({ type: "setSession", patch });
	const factor = el<HTMLInputElement>(block, "#scale-factor");
	const target = el<HTMLSelectElement>(block, "#scale-target");
	const qty = el<HTMLInputElement>(block, "#scale-qty");
	const unit = el<HTMLInputElement>(block, "#scale-unit");
	factor.addEventListener("change", () => {
		const value = Number(factor.value);
		post({
			scale:
				factor.value === "" || !(value > 0)
					? null
					: { type: "factor", value: value / 100 },
		});
	});
	target.addEventListener("change", () => {
		const item = choices?.ingredients.find((i) => i.id === target.value);
		qty.value = item?.qty !== undefined ? String(item.qty) : "";
		unit.value = item?.unit ?? "";
	});
	const apply = () => {
		const amount = Number(qty.value);
		if (!target.value || !(amount > 0)) return;
		post({
			scale: {
				type: "target",
				id: target.value,
				qty: amount,
				unit: unit.value.trim() || null,
			},
		});
	};
	el(block, "#scale-apply").addEventListener("click", apply);
	for (const input of [qty, unit]) {
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") apply();
		});
	}
	const bakers = el<HTMLSelectElement>(block, "#bakers-ref");
	bakers.addEventListener("change", () => {
		post({ bakersReference: bakers.value || null });
	});
	el(block, "#stock").addEventListener("change", () => {
		const uris = [
			...block.querySelectorAll<HTMLInputElement>("#stock input:checked"),
		].map((box) => box.value);
		post({ stock: uris.length > 0 ? uris : null });
	});
	el(block, "#session-reset").addEventListener("click", () => {
		target.value = "";
		qty.value = "";
		unit.value = "";
		post({ scale: null, stock: null, bakersReference: null });
	});
	block.addEventListener("toggle", () => {
		vscode.postMessage({ type: "choose", open: block.open });
	});
}

window.addEventListener("message", (event: MessageEvent<ToPage>) => {
	const message = event.data;
	switch (message.type) {
		case "content":
			show(message.content);
			break;
		case "paused":
			pause(message.error);
			break;
		case "showMacros":
			showMacros();
			break;
		case "session":
			setSession(message.session);
			break;
		case "suggestions":
			showSuggestions(message.data);
			break;
		case "choices":
			showChoices(message.data);
			break;
	}
});
el(banner, "button").addEventListener("click", () => {
	vscode.postMessage({ type: "showError" });
});
vscode.postMessage({ type: "ready" });
