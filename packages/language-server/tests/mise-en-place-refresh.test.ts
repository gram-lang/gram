import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile, scheduleTimes } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { formatDuration } from "@gram-lang/renderer";
import { Client, URI } from "./helpers/lsp-client";

/*
 * The `gram.miseEnPlace` setting, end to end: the built language server is
 * started as a process and spoken to over LSP, the way VS Code does. What is
 * checked is when, and with what, the preview is re-rendered. Unit tests can't
 * see this: the behaviour lives in how `server.ts` wires the connection.
 */

// Under a day, so the total keeps its minutes and tells the schedules apart;
// the run sheet takes it two days ahead, to be laid out in days.
const RECIPE = (title: string, ahead = "-2h") => `---
title: ${title}
---

## Pastry ~{${ahead}}

Mix @flour{200g}(sifted).

## Assembly

Combine the pastry with @filling{300g}.
`;

// The retro-planning offset makes the two schedules give different totals.
const compiled = compile(getAST(RECIPE("Tart")));
const TOTAL = {
	perSection: formatDuration(scheduleTimes(compiled, "perSection").totalTime),
	upfront: formatDuration(scheduleTimes(compiled, "upfront").totalTime),
};

const totalOf = (html: string) =>
	/timing-pill total[^>]*>[\s\S]*?<span class="timing-text[^"]*">([^<]+)</.exec(
		html,
	)?.[1];
const titleOf = (html: string) => /<h1[^>]*>([^<]*)</.exec(html)?.[1];
const summary = (html: string) => `${titleOf(html)}/${totalOf(html)}`;

let client: Client | undefined;
afterEach(() => client?.stop());

describe("gram.miseEnPlace in the language server", () => {
	it("sanity: the two schedules do not give the same total", () => {
		expect(TOTAL.upfront).not.toBe(TOTAL.perSection);
	});

	it("renders by section until told otherwise", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Tart"));
		const html = await client.previewMatching((h) => totalOf(h) !== undefined);
		expect(totalOf(html)).toBe(TOTAL.perSection);
	}, 20_000);

	it("applies the setting to a recipe already open when it arrives", async () => {
		client = new Client();
		client.setting = "upfront";
		client.configDelay = 300; // the recipe is opened well before the answer
		await client.start();
		client.open(RECIPE("Tart"));
		// No edit, nothing else: the preview has to catch up by itself.
		const html = await client.previewMatching(
			(h) => totalOf(h) === TOTAL.upfront,
		);
		expect(titleOf(html)).toBe("Tart");
	}, 20_000);

	it("re-renders every open recipe when the setting changes", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Tart"));
		await client.previewMatching((h) => totalOf(h) === TOTAL.perSection);

		client.setting = "upfront";
		client.settingChanged();
		await client.previewMatching((h) => totalOf(h) === TOTAL.upfront);

		const hints = (await client.request("textDocument/inlayHint", {
			textDocument: { uri: URI },
			range: {
				start: { line: 0, character: 0 },
				end: { line: 20, character: 0 },
			},
		})) as Array<{ label: string }>;
		const hint = hints.map((h) => h.label).join("");
		expect(hint).toContain(`Total time: ${TOTAL.upfront}`);
	}, 20_000);

	it("ends on the newest text and the new schedule when a keystroke is still pending", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Old"));
		await client.previewMatching((h) => titleOf(h) === "Old");

		// An edit waits in the 150 ms debounce when the setting changes.
		client.setting = "upfront";
		client.change(RECIPE("New"), 2);
		client.settingChanged();

		await client.previewMatching(
			(h) => titleOf(h) === "New" && totalOf(h) === TOTAL.upfront,
		);
		await client.settle();
		const last = client.previews().at(-1) ?? "";
		expect(summary(last)).toBe(`New/${TOTAL.upfront}`);
	}, 20_000);

	it("falls back on the default for a value it does not know", async () => {
		client = new Client();
		client.setting = "sideways";
		await client.start();
		client.open(RECIPE("Tart"));
		const html = await client.previewMatching((h) => totalOf(h) !== undefined);
		expect(totalOf(html)).toBe(TOTAL.perSection);
	}, 20_000);
});

// A rest written as a range: the choice of rests moves the total, and nothing
// else here does.
const RANGED = (title: string) => `---
title: ${title}
---

## Dough ->&dough

Knead @flour{500g} ~{20min}, then rest ~_{8-16h}.

## Bake

Bake &dough{500g} ~{30min}.
`;
const ranged = compile(getAST(RANGED("Bread")));
const REST_TOTAL = {
	shortest: formatDuration(
		scheduleTimes(ranged, undefined, "shortest").totalTime,
	),
	longest: formatDuration(
		scheduleTimes(ranged, undefined, "longest").totalTime,
	),
};

describe("gram.rests in the language server", () => {
	it("sanity: the shortest and the longest rests do not give the same total", () => {
		expect(REST_TOTAL.longest).not.toBe(REST_TOTAL.shortest);
	});

	it("renders with the shortest rests until told otherwise", async () => {
		client = new Client();
		await client.start();
		client.open(RANGED("Bread"));
		const html = await client.previewMatching((h) => totalOf(h) !== undefined);
		expect(totalOf(html)).toBe(REST_TOTAL.shortest);
	}, 20_000);

	it("applies the setting to a recipe already open, and re-renders when it changes", async () => {
		client = new Client();
		client.rests = "longest";
		client.configDelay = 300;
		await client.start();
		client.open(RANGED("Bread"));
		await client.previewMatching((h) => totalOf(h) === REST_TOTAL.longest);

		client.rests = "shortest";
		client.settingChanged();
		await client.previewMatching((h) => totalOf(h) === REST_TOTAL.shortest);
	}, 20_000);

	it("falls back on the shortest for a value it does not know", async () => {
		client = new Client();
		client.rests = "sideways";
		await client.start();
		client.open(RANGED("Bread"));
		const html = await client.previewMatching((h) => totalOf(h) !== undefined);
		expect(totalOf(html)).toBe(REST_TOTAL.shortest);
	}, 20_000);
});

describe("the run sheet in the language server", () => {
	it("renders the run sheet in days before the service", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(RECIPE("Tart", "-2d"));
		client.openViews(["runSheet"]);
		const html = await client.viewHtml("runSheet", (h) =>
			h.includes("Run sheet — Tart"),
		);
		expect(html).toContain("run-sheet-day");
		// By section (the default), the things to take out sit with their section.
		expect(html).toContain("section-station-card");
		// No serving time in the editor: the days are counted back from it.
		expect(html).toContain("D-2");
		expect(html).not.toContain("<script");
	}, 20_000);

	it("takes its kit from gram.miseEnPlace: the filling is taken out at the first visit in upfront only", async () => {
		const firstDay = (html: string) =>
			html.split('class="run-sheet-day"')[1] ?? "";
		client = new Client();
		await client.start({ views: true });
		client.open(RECIPE("Tart", "-2d"));
		client.openViews(["runSheet"]);
		const bySection = await client.viewHtml("runSheet", (h) =>
			h.includes("Run sheet — Tart"),
		);
		expect(firstDay(bySection)).not.toContain("filling");

		client.setting = "upfront";
		client.settingChanged();
		const upfront = await client.viewHtml("runSheet", (h) =>
			firstDay(h).includes("filling"),
		);
		expect(firstDay(upfront)).toContain("flour");
	}, 20_000);

	it("keeps sending the Gantt chart notification to older clients until 2.0.0", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Tart"));
		const html = await client.htmlOf("gram/ganttUpdated", (h) =>
			h.includes("gantt"),
		);
		expect(html.length).toBeGreaterThan(0);
		// The run sheet has its own output now: older clients no longer get it.
		await client.settle();
		expect(client.notes.some((n) => n.method === "gram/runSheetUpdated")).toBe(
			false,
		);
	}, 20_000);
});

const NOTED = `---
title: Cake
---

## Cake

Mix @flour{100g} // keep it cold
and stir ~{5min}.

// Do not overmix.

Bake ~{20min}.
`;

describe("gram.comments in the language server", () => {
	it("shows the comments in the recipe and the run sheet until told otherwise", async () => {
		client = new Client();
		await client.start({ views: true });
		client.open(NOTED);
		client.openViews(["recipe", "runSheet"]);
		const html = await client.viewHtml("recipe", (h) =>
			h.includes("Do not overmix."),
		);
		expect(html).toContain("keep it cold");
		const plan = await client.viewHtml("runSheet", (h) =>
			h.includes("Do not overmix."),
		);
		expect(plan).toContain("inline-comment");
	}, 20_000);

	it("leaves them out of both when set to hide, and shows them again when it changes", async () => {
		client = new Client();
		client.comments = "hide";
		client.configDelay = 300;
		await client.start({ views: true });
		client.open(NOTED);
		client.openViews(["recipe", "runSheet"]);
		// What is sent before the setting was read still has them: wait for the next.
		const recipe = await client.viewHtml(
			"recipe",
			(h) => h.includes("Cake") && !h.includes("Do not overmix."),
		);
		expect(recipe).not.toContain("keep it cold");
		const plan = await client.viewHtml(
			"runSheet",
			(h) => h.includes("Run sheet") && !h.includes("Do not overmix."),
		);
		expect(plan).not.toContain("keep it cold");

		client.comments = "show";
		client.settingChanged();
		await client.viewHtml("recipe", (h) => h.includes("Do not overmix."));
	}, 20_000);
});

describe("gram.stepQuantities in the language server", () => {
	it("writes the quantities in the steps, and leaves them out when told", async () => {
		client = new Client();
		await client.start();
		client.open(RECIPE("Tart"));
		await client.previewMatching((h) => h.includes('class="step-quantity"'));

		client.extra = { stepQuantities: "hide" };
		client.settingChanged();
		await client.previewMatching(
			(h) => h.includes("Tart") && !h.includes('class="step-quantity"'),
		);
	}, 20_000);
});

describe("the recipe settings in the language server", () => {
	const dir = mkdtempSync(join(tmpdir(), "gram-recipe-settings-"));
	const db = join(dir, "ingredients.yaml");
	writeFileSync(
		db,
		"ingredients:\n  flour:\n    name: flour\n    physical:\n      density: 0.59\n    nutrition:\n      calories: 364\n      protein: 10\n      carbs: 76\n      fat: 1\n",
	);
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	it("analyzes the open recipe again when gram.nutritionEstimation changes", async () => {
		client = new Client();
		client.extra = { ingredientDatabase: { path: db } };
		await client.start();
		client.open(RECIPE("Tart"));
		await client.previewMatching((h) => h.includes("nutrition-panel"));

		client.extra = {
			ingredientDatabase: { path: db },
			nutritionEstimation: false,
		};
		client.settingChanged();
		await client.previewMatching(
			(h) => h.includes("Tart") && !h.includes("nutrition-panel"),
		);
	}, 20_000);
});
