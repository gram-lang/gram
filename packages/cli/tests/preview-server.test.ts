import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	DEFAULT_RECIPE_SETTINGS,
	TOOLTIP_SCRIPT,
	type ViewDefinition,
	views,
} from "@gram-lang/renderer";
import { getDictionary } from "@gram-lang/i18n";
import {
	type PreviewRenderResult,
	type PreviewServerHandle,
	startPreviewServer,
} from "../src/services/preview-server";
import { createPreviewRender } from "../src/services/view-serve";

const HTML_VIEWS = (views as readonly ViewDefinition[]).filter((view) =>
	view.formats.includes("html"),
);

/** The render `gram view --serve` gives the server, slowed down on demand. */
function renderOf(file: string, delay?: (n: number) => number) {
	const render = createPreviewRender({
		file,
		args: { "skip-db": true, tz: "UTC", now: "2026-01-01 08:00" },
		rawArgs: [],
		settings: {},
		recipe: DEFAULT_RECIPE_SETTINGS,
		bakersReference: undefined,
	});
	let calls = 0;
	return async (
		view: ViewDefinition,
		format: "html" | "print",
	): Promise<PreviewRenderResult> => {
		const n = calls++;
		const result = await render(view, format);
		const wait = delay?.(n) ?? 0;
		if (wait) await new Promise((r) => setTimeout(r, wait));
		return result;
	};
}

const t = getDictionary("en").renderer;
const STRINGS = {
	lang: "en",
	views: t.outputs,
	print: t.print,
	outputEmpty: t.outputEmpty,
	disconnected: t.disconnected,
};

const RECIPE =
	"---\ntitle: Tarte aux pommes\n---\n\n## Prep\n\n[Mix] Add @flour{200g}.\n";

interface SseEvent {
	event: string;
	data: {
		html: string | null;
		error: { message: string } | null;
		title: string | null;
	};
}

/** Reads a Server-Sent Events stream: neither Bun nor Node has `EventSource`. */
function openEvents(url: string) {
	const controller = new AbortController();
	const events: SseEvent[] = [];
	const waiters: (() => void)[] = [];
	const done = (async () => {
		const res = await fetch(url, { signal: controller.signal });
		const reader = res.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = "";
		try {
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let end = buffer.indexOf("\n\n");
				while (end !== -1) {
					const block = buffer.slice(0, end);
					buffer = buffer.slice(end + 2);
					let event = "message";
					let data = "";
					for (const line of block.split("\n")) {
						if (line.startsWith("event: ")) event = line.slice(7);
						else if (line.startsWith("data: ")) data += line.slice(6);
					}
					if (data) {
						events.push({ event, data: JSON.parse(data) });
						for (const w of waiters.splice(0)) w();
					}
					end = buffer.indexOf("\n\n");
				}
			}
		} catch {
			// Aborted or closed by the server.
		}
	})();
	return {
		events,
		/** Waits for an event that `match` accepts, among those already received or to come. */
		async until(
			match: (e: SseEvent) => boolean,
			timeout = 4000,
		): Promise<SseEvent> {
			const deadline = Date.now() + timeout;
			for (;;) {
				const found = events.find(match);
				if (found) return found;
				const left = deadline - Date.now();
				if (left <= 0) throw new Error("timed out waiting for an event");
				await new Promise<void>((r) => {
					const timer = setTimeout(r, left);
					waiters.push(() => {
						clearTimeout(timer);
						r();
					});
				});
			}
		},
		close: async () => {
			controller.abort();
			await done;
		},
		done,
	};
}

describe("preview server", () => {
	// No config of this machine reaches the renders.
	const home = process.env.HOME;
	let fakeHome: string;
	beforeAll(async () => {
		fakeHome = await mkdtemp(join(tmpdir(), "gram-home-"));
		process.env.HOME = fakeHome;
	});
	afterAll(async () => {
		process.env.HOME = home;
		await rm(fakeHome, { recursive: true, force: true });
	});

	let dir: string;
	let handle: PreviewServerHandle | undefined;
	const streams: ReturnType<typeof openEvents>[] = [];

	async function start(
		content = RECIPE,
		delay?: (n: number) => number,
	): Promise<{ file: string; handle: PreviewServerHandle }> {
		dir = await mkdtemp(join(tmpdir(), "gram-preview-"));
		const file = join(dir, "tarte.gram");
		await writeFile(file, content, "utf-8");
		handle = await startPreviewServer({
			views: HTML_VIEWS,
			initialView: "recipe",
			port: 0,
			render: renderOf(file, delay),
			strings: STRINGS,
			debounceMs: 50,
		});
		return { file, handle };
	}

	function events(view = "recipe") {
		const stream = openEvents(`${handle!.url}/events?view=${view}`);
		streams.push(stream);
		return stream;
	}

	afterEach(async () => {
		for (const s of streams.splice(0)) await s.close();
		await handle?.close();
		handle = undefined;
		if (dir) await rm(dir, { recursive: true, force: true });
	});

	it("serves the page, the styles and the views' script on 127.0.0.1", async () => {
		const { handle } = await start();
		expect(handle.url).toBe(`http://127.0.0.1:${handle.port}`);

		const page = await fetch(`${handle.url}/`);
		expect(page.status).toBe(200);
		expect(page.headers.get("content-security-policy")).toContain(
			"default-src 'self'",
		);
		expect(page.headers.get("content-security-policy")).not.toContain(
			"script-src",
		);
		const html = await page.text();
		expect(html).toContain("<title>Tarte aux pommes</title>");
		expect(html).toContain('class="gram-preview show-macros"');
		for (const view of HTML_VIEWS) {
			expect(html).toContain(`>${t.outputs[view.id]}</a>`);
		}
		expect(html).toContain('data-view-tab="run-sheet"');
		expect(html).toContain("flour");

		const css = await fetch(`${handle.url}/gram.css`);
		expect(css.headers.get("content-type")).toContain("text/css");
		expect((await css.text()).length).toBeGreaterThan(100);

		const client = await fetch(`${handle.url}/client.js`);
		expect(client.headers.get("content-type")).toContain("text/javascript");
		expect(await client.text()).toBe(TOOLTIP_SCRIPT);

		expect((await fetch(`${handle.url}/nope`)).status).toBe(404);
	});

	it("refuses a request for another host name", async () => {
		const { handle } = await start();
		const status = await new Promise<number>((resolveStatus, reject) => {
			const req = request(
				{
					host: "127.0.0.1",
					port: handle.port,
					path: "/",
					headers: { Host: "evil.example" },
				},
				(res) => {
					res.resume();
					resolveStatus(res.statusCode ?? 0);
				},
			);
			req.on("error", reject);
			req.end();
		});
		expect(status).toBe(403);
	});

	it("renders each view, its print layout, and refuses an unknown one", async () => {
		const { handle } = await start();
		const recipe = await (
			await fetch(`${handle.url}/render?view=recipe`)
		).json();
		expect(recipe.view).toBe("recipe");
		expect(recipe.title).toBe("Tarte aux pommes");
		expect(recipe.html).toContain("gram-recipe");
		expect(recipe.error).toBeNull();

		const sheet = await (
			await fetch(`${handle.url}/render?view=run-sheet`)
		).json();
		expect(sheet.html).toContain("gram-run-sheet");

		const print = await fetch(`${handle.url}/print?view=recipe`);
		expect(print.headers.get("content-security-policy")).toContain(
			"default-src 'none'; style-src 'unsafe-inline'; img-src data:",
		);
		expect((await print.text()).toLowerCase()).toContain("<html");

		expect((await fetch(`${handle.url}/render?view=nope`)).status).toBe(400);
		expect((await fetch(`${handle.url}/?view=nope`)).status).toBe(400);
	});

	it("pushes an update when the file is saved, directly or by a rename", async () => {
		const { file } = await start();
		const stream = events();
		await stream.until((e) => e.data.html?.includes("flour") ?? false);

		await writeFile(file, RECIPE.replace("flour", "sugar"), "utf-8");
		await stream.until((e) => e.data.html?.includes("sugar") ?? false);

		// Neovim, Helix, Zed: a temporary file renamed over the recipe.
		const temp = join(dir, ".tarte.gram.swp");
		await writeFile(temp, RECIPE.replace("flour", "butter"), "utf-8");
		await rename(temp, file);
		await stream.until((e) => e.data.html?.includes("butter") ?? false);
	});

	it("follows the @use imports, even one written before its file", async () => {
		const main = `---\ntitle: Tarte\n---\n\n@use "./pate.gram" as &pate\n\n## Montage\n\n[Foncer] avec &pate{500g}.\n`;
		const { file } = await start(main);
		const base = join(dir, "pate.gram");
		await writeFile(base, "## Pâte\n\n[Mix] Add @butter{100g}.\n", "utf-8");
		const stream = events();
		await stream.until((e) => e.event === "update");

		await writeFile(base, "## Pâte\n\n[Mix] Add @margarine{100g}.\n", "utf-8");
		await stream.until((e) => e.data.html?.includes("margarine") ?? false);

		// A second import, to a file that does not exist yet.
		await writeFile(
			file,
			main
				.replace("## Montage", '@use "./creme.gram" as &creme\n\n## Montage')
				.replace("&pate{500g}.", "&pate{500g} et &creme{200g}."),
			"utf-8",
		);
		await stream.until((e) => e.data.html?.includes("creme") ?? false);
		await writeFile(
			join(dir, "creme.gram"),
			"## Crème\n\n[Mix] Add @vanilla{1}.\n",
			"utf-8",
		);
		await stream.until((e) => e.data.html?.includes("vanilla") ?? false);
	});

	it("keeps serving through a syntax error and recovers", async () => {
		const { file } = await start();
		const stream = events();
		await stream.until((e) => e.event === "update");

		await writeFile(file, "## Section\n@ <@parent\n", "utf-8");
		const broken = await stream.until((e) => e.data.error !== null);
		expect(broken.data.error?.message.length).toBeGreaterThan(0);

		await writeFile(file, RECIPE.replace("flour", "rye"), "utf-8");
		const fixed = await stream.until(
			(e) => e.data.error === null && (e.data.html?.includes("rye") ?? false),
		);
		expect(fixed.data.error).toBeNull();
	});

	it("never lets an old render overwrite a newer one", async () => {
		// The first render after the start is slow: the first save.
		const { file } = await start(RECIPE, (n) => (n === 2 ? 400 : 0));
		const stream = events();
		await stream.until((e) => e.event === "update");

		await writeFile(file, RECIPE.replace("flour", "first"), "utf-8");
		await new Promise((r) => setTimeout(r, 120));
		await writeFile(file, RECIPE.replace("flour", "second"), "utf-8");

		await stream.until((e) => e.data.html?.includes("second") ?? false);
		await new Promise((r) => setTimeout(r, 600));
		const last = stream.events.at(-1)!;
		expect(last.data.html).toContain("second");
	});

	it("closes with a client still connected", async () => {
		const { handle: h } = await start();
		const stream = events();
		await stream.until((e) => e.event === "update");
		await h.close();
		handle = undefined;
		await stream.done;
		await expect(fetch(`${h.url}/`)).rejects.toThrow();
	});
});
