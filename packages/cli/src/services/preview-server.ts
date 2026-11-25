import { type FSWatcher, readFileSync, watch } from "node:fs";
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import {
	type DescribableDiagnostic,
	type ErrorDescription,
	TOOLTIP_SCRIPT,
	type ViewDefinition,
} from "@gram-lang/renderer";
import { cliViewName } from "../core/cli-views";
import { ExitCode, GramCLIError } from "../errors";

/*
 * The live preview of `gram view --serve`: a local feedback loop for the
 * author, not a web application. It serves one page with a tab per view, keeps
 * it up to date over Server-Sent Events, and watches the files the last render
 * was read from. It knows nothing of the pipeline, the config or the database:
 * `render()` does, and tells it which files to watch.
 */

/** What one render of a view gives the server. */
export interface PreviewRenderResult {
	/** The recipe's title, for the page's `<title>`. */
	title?: string;
	/** `null`: the view has nothing to show for this recipe. */
	html: string | null;
	/** Why the recipe could not be rendered; `html` is then ignored. */
	error: ErrorDescription<DescribableDiagnostic> | null;
	/** The absolute paths to watch after this render. */
	watch: string[];
}

/** The words of the page, already in the reader's language (`@gram-lang/i18n`). */
export interface PreviewStrings {
	/** The language of the page (`<html lang>`). */
	lang: string;
	/** The name of each view, by its id (`renderer.outputs`). */
	views: Record<string, string>;
	print: string;
	outputEmpty: string;
	disconnected: string;
}

export interface PreviewServerOptions {
	/** The views offered, one tab each (those that have the `html` format). */
	views: readonly ViewDefinition[];
	/** The view shown first, by its command-line name. */
	initialView: string;
	/** Absent: 4173, else a free port. Given: that port or an error. `0`: any free port. */
	port?: number;
	render: (
		view: ViewDefinition,
		format: "html" | "print",
	) => Promise<PreviewRenderResult>;
	strings: PreviewStrings;
	/** How long to wait after a file event before rendering again (ms). */
	debounceMs?: number;
}

export interface PreviewServerHandle {
	url: string;
	port: number;
	close: () => Promise<void>;
}

export const DEFAULT_PREVIEW_PORT = 4173;
const HOST = "127.0.0.1";
const HEARTBEAT_MS = 30_000;

/** What a page receives for one render: data, never markup to trust beyond `html`. */
interface Payload {
	view: string;
	title: string | null;
	html: string | null;
	error: {
		title: string;
		description: string;
		message: string;
		code: string | null;
	} | null;
}

const PAGE_CSP =
	"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'";
const PRINT_CSP =
	"default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'";

/** The bar, the banner and the paused state: the few rules the views do not bring. */
export const PREVIEW_CSS = `html,
body {
	margin: 0;
	background: var(--color-bg);
	color: var(--color-text-strong);
	font-family: var(--gram-font-sans);
}
#top {
	position: sticky;
	top: 0;
	z-index: 10;
	background: var(--color-bg);
}
#bar {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 6px 12px;
	font-size: 13px;
	border-bottom: 1px solid var(--color-border);
}
#bar .tabs {
	display: flex;
	gap: 4px;
	flex: 1;
}
#bar a,
#bar button {
	font: inherit;
	padding: 3px 10px;
	border-radius: 6px;
	border: 1px solid transparent;
	color: var(--color-text-muted);
	background: none;
	text-decoration: none;
	cursor: pointer;
}
#bar a:hover,
#bar button:hover {
	color: var(--color-text-strong);
	background: var(--color-bg-muted);
}
#bar a[aria-current="page"] {
	color: var(--color-text-strong);
	background: var(--color-bg-muted);
	border-color: var(--color-border);
}
#bar button {
	border-color: var(--color-border);
}
#status {
	color: var(--color-text-muted);
}
#status[hidden],
#banner[hidden] {
	display: none;
}
#banner {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 6px 12px;
	font-size: 13px;
	color: #92400e;
	background: #fef3c7;
	border-bottom: 1px solid #fcd34d;
}
:root[data-theme="dark"] #banner {
	color: #fcd34d;
	background: #422006;
	border-color: #92400e;
}
#banner .title {
	font-weight: 600;
}
#banner .message {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
#content {
	max-width: 960px;
	margin: 0 auto;
	padding: 8px 16px 48px;
}
body.paused #content {
	opacity: 0.45;
	transition: opacity 120ms;
}
.gram-empty {
	padding: 24px 0;
	color: var(--color-text-muted);
}
.print-frame {
	position: fixed;
	right: 0;
	bottom: 0;
	width: 0;
	height: 0;
	border: 0;
	visibility: hidden;
}
`;

/**
 * The page's own script: the theme of the machine, the live updates, the tabs
 * and the print button. The views' interactivity (tooltips, highlighted
 * intermediates, checked steps) is `/client.js`, loaded before it, whose
 * listeners are delegated on `document` and so survive every update.
 */
export const PREVIEW_JS = `(function () {
	"use strict";
	var body = document.body;
	var root = document.documentElement;
	var strings = JSON.parse(body.getAttribute("data-strings") || "{}");
	var content = document.getElementById("content");
	var banner = document.getElementById("banner");
	var status = document.getElementById("status");
	var view = body.getAttribute("data-view");
	var source = null;

	var dark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
	function theme() {
		if (dark && dark.matches) root.setAttribute("data-theme", "dark");
		else root.removeAttribute("data-theme");
	}
	theme();
	if (dark && dark.addEventListener) dark.addEventListener("change", theme);

	function pause(error) {
		body.classList.toggle("paused", Boolean(error));
		banner.hidden = !error;
		if (!error) return;
		banner.querySelector(".title").textContent = error.title;
		var message = banner.querySelector(".message");
		message.textContent = error.message;
		message.title = error.description + "\\n\\n" + error.message;
	}

	function show(payload) {
		status.hidden = true;
		if (payload.title) document.title = payload.title;
		pause(payload.error);
		// A recipe that stopped compiling keeps its last view, dimmed.
		if (payload.error) return;
		if (payload.html === null) {
			var empty = document.createElement("p");
			empty.className = "gram-empty";
			empty.textContent = strings.outputEmpty;
			content.replaceChildren(empty);
		} else {
			content.innerHTML = payload.html;
		}
	}

	function connect() {
		if (source) source.close();
		source = new EventSource("/events?view=" + encodeURIComponent(view));
		source.addEventListener("update", function (event) {
			show(JSON.parse(event.data));
		});
		source.onerror = function () {
			status.textContent = strings.disconnected;
			status.hidden = false;
		};
	}

	var tabs = document.querySelectorAll("[data-view-tab]");
	for (var i = 0; i < tabs.length; i++) {
		tabs[i].addEventListener("click", function (event) {
			event.preventDefault();
			var next = this.getAttribute("data-view-tab");
			if (next === view) return;
			view = next;
			body.setAttribute("data-view", view);
			for (var j = 0; j < tabs.length; j++) {
				if (tabs[j] === this) tabs[j].setAttribute("aria-current", "page");
				else tabs[j].removeAttribute("aria-current");
			}
			history.replaceState(null, "", "?view=" + encodeURIComponent(view));
			connect();
		});
	}

	document.getElementById("print").addEventListener("click", function () {
		var old = document.querySelector(".print-frame");
		if (old) old.remove();
		var frame = document.createElement("iframe");
		frame.className = "print-frame";
		frame.setAttribute("aria-hidden", "true");
		frame.addEventListener("load", function () {
			frame.contentWindow.focus();
			frame.contentWindow.print();
		});
		frame.src = "/print?view=" + encodeURIComponent(view);
		body.appendChild(frame);
	});

	connect();
})();
`;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function toPayload(view: string, result: PreviewRenderResult): Payload {
	return {
		view,
		title: result.title ?? null,
		html: result.error ? null : result.html,
		error: result.error
			? {
					title: result.error.title,
					description: result.error.description,
					message: result.error.message,
					code: result.error.code ?? null,
				}
			: null,
	};
}

/** `gram.css` of the renderer, read once: the screen styles of every view. */
function readGramCss(): string {
	const require = createRequire(import.meta.url);
	return readFileSync(require.resolve("@gram-lang/renderer/gram.css"), "utf-8");
}

function listen(server: Server, port: number): Promise<number> {
	return new Promise((resolveListen, reject) => {
		const onError = (err: NodeJS.ErrnoException) => {
			server.off("listening", onListening);
			reject(err);
		};
		const onListening = () => {
			server.off("error", onError);
			const address = server.address();
			resolveListen(
				typeof address === "object" && address ? address.port : port,
			);
		};
		server.once("error", onError);
		server.once("listening", onListening);
		server.listen(port, HOST);
	});
}

/** Starts the live preview. Resolves once it listens. */
export async function startPreviewServer(
	options: PreviewServerOptions,
): Promise<PreviewServerHandle> {
	const debounceMs = options.debounceMs ?? 150;
	const byName = new Map(
		options.views.map((view) => [cliViewName(view.id), view] as const),
	);
	if (!byName.has(options.initialView)) {
		throw new GramCLIError(
			`Unknown view "${options.initialView}".`,
			ExitCode.Error,
		);
	}
	const gramCss = readGramCss();
	const strings = options.strings;

	/** The clients of each view, by its command-line name. */
	const clients = new Map<string, Set<ServerResponse>>();
	/** Bumped on every change: a render started before it is out of date. */
	let generation = 0;
	let watched = new Set<string>();
	const dirWatchers = new Map<string, FSWatcher>();
	/** The last render failed: re-render on any event of the watched folders. */
	let inError = false;
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let running = false;
	let pending = false;
	let closed = false;
	let port = 0;

	function syncWatchers(): void {
		const dirs = new Set([...watched].map((file) => dirname(file)));
		for (const [dir, watcher] of dirWatchers) {
			if (!dirs.has(dir)) {
				watcher.close();
				dirWatchers.delete(dir);
			}
		}
		for (const dir of dirs) {
			if (dirWatchers.has(dir)) continue;
			try {
				const watcher = watch(dir, (_event, filename) => {
					onFsEvent(dir, filename ? String(filename) : null);
				});
				watcher.on("error", () => {
					watcher.close();
					dirWatchers.delete(dir);
				});
				dirWatchers.set(dir, watcher);
			} catch {
				// A folder that does not exist (no project config yet): nothing to watch.
			}
		}
	}

	function onFsEvent(dir: string, filename: string | null): void {
		if (closed) return;
		// Some systems give no file name: any event of the folder counts.
		if (filename !== null && !inError && !watched.has(resolve(dir, filename))) {
			return;
		}
		if (debounce) clearTimeout(debounce);
		debounce = setTimeout(() => {
			debounce = undefined;
			generation++;
			void runWave();
		}, debounceMs);
	}

	/** Renders a view and follows the files it was read from. */
	async function renderTracked(
		view: ViewDefinition,
		format: "html" | "print",
	): Promise<PreviewRenderResult> {
		const started = generation;
		let result: PreviewRenderResult;
		try {
			result = await options.render(view, format);
		} catch (err) {
			// `render()` turns errors into descriptions; this is a bug, still shown.
			const message = err instanceof Error ? err.message : String(err);
			result = {
				html: null,
				error: {
					title: message,
					description: message,
					diagnostic: { message },
					code: undefined,
					message,
					uri: undefined,
					range: undefined,
				},
				watch: [],
			};
		}
		if (started === generation && !closed) {
			const files = result.watch.map((file) => resolve(file));
			if (result.error) {
				// A parse error comes before the graph: keep what was watched.
				inError = true;
				watched = new Set([...watched, ...files]);
			} else {
				inError = false;
				watched = new Set(files);
			}
			syncWatchers();
		}
		return result;
	}

	function send(res: ServerResponse, payload: Payload): void {
		res.write(`event: update\ndata: ${JSON.stringify(payload)}\n\n`);
	}

	/** One render per view that has a client, sent to all of its clients. */
	async function runWave(): Promise<void> {
		if (closed) return;
		if (running) {
			pending = true;
			return;
		}
		running = true;
		try {
			const wave = generation;
			for (const [name, set] of clients) {
				if (set.size === 0) continue;
				const view = byName.get(name);
				if (!view) continue;
				const result = await renderTracked(view, "html");
				// A newer change is on its way: this render is out of date.
				if (wave !== generation || closed) break;
				const payload = toPayload(name, result);
				for (const res of set) send(res, payload);
			}
			// No client: still follow the files, for the first page to come.
			if (clients.size === 0 || [...clients.values()].every((s) => !s.size)) {
				const view = byName.get(options.initialView);
				if (view) await renderTracked(view, "html");
			}
		} finally {
			running = false;
		}
		if (pending && !closed) {
			pending = false;
			await runWave();
		}
	}

	function viewOf(url: URL, res: ServerResponse): string | null {
		const name = url.searchParams.get("view") ?? options.initialView;
		if (!byName.has(name)) {
			res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
			res.end(
				`Unknown view "${name}". Expected one of: ${[...byName.keys()].join(", ")}.`,
			);
			return null;
		}
		return name;
	}

	function page(name: string, result: PreviewRenderResult): string {
		const payload = toPayload(name, result);
		const tabs = [...byName]
			.map(([tab, view]) => {
				const label = strings.views[view.id] ?? tab;
				const current = tab === name ? ' aria-current="page"' : "";
				return `<a href="/?view=${encodeURIComponent(tab)}" data-view-tab="${escapeHtml(tab)}"${current}>${escapeHtml(label)}</a>`;
			})
			.join("");
		const error = payload.error;
		const content =
			payload.html === null
				? error
					? ""
					: `<p class="gram-empty">${escapeHtml(strings.outputEmpty)}</p>`
				: payload.html;
		const data = escapeHtml(
			JSON.stringify({
				outputEmpty: strings.outputEmpty,
				disconnected: strings.disconnected,
			}),
		);
		return `<!doctype html>
<html lang="${escapeHtml(strings.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(payload.title ?? "Gram")}</title>
<link rel="stylesheet" href="/gram.css">
<link rel="stylesheet" href="/preview.css">
</head>
<body data-view="${escapeHtml(name)}" data-strings="${data}"${error ? ' class="paused"' : ""}>
<div id="top">
<nav id="bar"><div class="tabs">${tabs}</div><span id="status" role="status" hidden></span><button id="print" type="button">${escapeHtml(strings.print)}</button></nav>
<div id="banner" role="alert"${error ? "" : " hidden"}><span class="title">${escapeHtml(error?.title ?? "")}</span><span class="message"${error ? ` title="${escapeHtml(`${error.description}\n\n${error.message}`)}"` : ""}>${escapeHtml(error?.message ?? "")}</span></div>
</div>
<main id="content" class="gram-preview show-macros">${content}</main>
<script src="/client.js"></script>
<script src="/preview.js"></script>
</body>
</html>
`;
	}

	const common = { "X-Content-Type-Options": "nosniff" };

	function serveText(
		res: ServerResponse,
		type: string,
		body: string,
		headers: Record<string, string> = {},
	): void {
		res.writeHead(200, {
			...common,
			"Content-Type": `${type}; charset=utf-8`,
			"Cache-Control": "no-cache",
			...headers,
		});
		res.end(body);
	}

	async function handle(req: IncomingMessage, res: ServerResponse) {
		// DNS rebinding: a page of another site that resolves to this machine
		// sends its own host name.
		const host = req.headers.host;
		if (host !== `${HOST}:${port}` && host !== `localhost:${port}`) {
			res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Forbidden");
			return;
		}
		if (req.method !== "GET" && req.method !== "HEAD") {
			res.writeHead(405, { Allow: "GET, HEAD" });
			res.end();
			return;
		}
		const url = new URL(req.url ?? "/", `http://${HOST}:${port}`);
		switch (url.pathname) {
			case "/": {
				const name = viewOf(url, res);
				if (!name) return;
				const result = await renderTracked(byName.get(name)!, "html");
				serveText(res, "text/html", page(name, result), {
					"Content-Security-Policy": PAGE_CSP,
				});
				return;
			}
			case "/gram.css":
				serveText(res, "text/css", gramCss);
				return;
			case "/preview.css":
				serveText(res, "text/css", PREVIEW_CSS);
				return;
			case "/client.js":
				serveText(res, "text/javascript", TOOLTIP_SCRIPT);
				return;
			case "/preview.js":
				serveText(res, "text/javascript", PREVIEW_JS);
				return;
			case "/render": {
				const name = viewOf(url, res);
				if (!name) return;
				const result = await renderTracked(byName.get(name)!, "html");
				serveText(
					res,
					"application/json",
					JSON.stringify(toPayload(name, result)),
				);
				return;
			}
			case "/print": {
				const name = viewOf(url, res);
				if (!name) return;
				const view = byName.get(name)!;
				if (!view.formats.includes("print")) {
					res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
					res.end(`The ${name} view has no print layout.`);
					return;
				}
				const result = await renderTracked(view, "print");
				const payload = toPayload(name, result);
				const body =
					payload.html ??
					`<!doctype html><meta charset="utf-8"><title>${escapeHtml(payload.title ?? "Gram")}</title><p>${escapeHtml(payload.error?.message ?? strings.outputEmpty)}</p>`;
				serveText(res, "text/html", body, {
					"Content-Security-Policy": PRINT_CSP,
				});
				return;
			}
			case "/events": {
				const name = viewOf(url, res);
				if (!name) return;
				res.writeHead(200, {
					...common,
					"Content-Type": "text/event-stream; charset=utf-8",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				res.flushHeaders();
				let set = clients.get(name);
				if (!set) {
					set = new Set();
					clients.set(name, set);
				}
				set.add(res);
				req.on("close", () => set.delete(res));
				// The first event is the current render of the view; a change
				// while it renders is sent by the wave it starts.
				const started = generation;
				const result = await renderTracked(byName.get(name)!, "html");
				if (started === generation && set.has(res)) {
					send(res, toPayload(name, result));
				}
				return;
			}
			default:
				res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
				res.end("Not found");
		}
	}

	const server = createServer((req, res) => {
		handle(req, res).catch((err) => {
			if (!res.headersSent) {
				res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
			}
			res.end(err instanceof Error ? err.message : String(err));
		});
	});

	if (options.port === undefined) {
		try {
			port = await listen(server, DEFAULT_PREVIEW_PORT);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
			port = await listen(server, 0);
		}
	} else {
		try {
			port = await listen(server, options.port);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
				throw new GramCLIError(
					`Port ${options.port} is already in use: choose another one with --port, or leave it out.`,
					ExitCode.Error,
				);
			}
			throw err;
		}
	}

	const heartbeat = setInterval(() => {
		for (const set of clients.values()) {
			for (const res of set) res.write(": ping\n\n");
		}
	}, HEARTBEAT_MS);
	heartbeat.unref();

	// The first render: what to watch before any page is open.
	const initial = byName.get(options.initialView);
	if (initial) await renderTracked(initial, "html");

	return {
		url: `http://${HOST}:${port}`,
		port,
		close: () =>
			new Promise<void>((resolveClose) => {
				closed = true;
				clearInterval(heartbeat);
				if (debounce) clearTimeout(debounce);
				for (const set of clients.values()) {
					for (const res of set) res.end();
					set.clear();
				}
				for (const watcher of dirWatchers.values()) watcher.close();
				dirWatchers.clear();
				server.close(() => resolveClose());
				server.closeAllConnections();
			}),
	};
}
