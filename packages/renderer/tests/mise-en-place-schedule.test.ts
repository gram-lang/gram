import { describe, expect, it } from "bun:test";
import { scheduleFor, compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { buildTracks } from "../src/gantt/layout";
import { toGanttHTML, toHTML, toMarkdown, toPrintHTML } from "../src/index";

// The three timelines of a compiled recipe, laid out from its task graph.
const schedulesOf = (c: Parameters<typeof scheduleFor>[0]) => ({
	perSection: scheduleFor(c, "perSection")!,
	upfront: scheduleFor(c, "upfront")!,
	perSession: scheduleFor(c, "perSession")!,
});

const SOURCE = `## Dough ->&dough

Mix @flour{500g} and @water{300ml} in a #bowl.

[Rest] Let the dough rest ~_{2h}.

## Filling ->&filling

Cook @onions{200g}(finely sliced) with @butter{30g}(cut into cubes) in a #pan.

## Assembly

Spread &filling over &dough, then bake for ~{25min}.
`;

const compiled = compile(getAST(SOURCE));

const countOf = (haystack: string, needle: string) =>
	haystack.split(needle).length - 1;

const shoppingList = (html: string) =>
	html.slice(
		html.indexOf('<details class="shopping-list">'),
		html.indexOf("</details>"),
	);

describe("compiled data used below", () => {
	it("has a mise en place for each of the three sections", () => {
		// Assembly makes nothing but weighs out the two intermediates it uses.
		expect(compiled.miseEnPlace.map((m) => m.section)).toEqual([0, 1, 2]);
	});
});

describe("HTML — perSection (default)", () => {
	const html = toHTML(compiled);

	it("captions the ingredient list of each section that has a mise en place", () => {
		expect(countOf(html, '<p class="section-prep">')).toBe(3);
		const boxes = html.match(
			/<div class="section-ingredients">[\s\S]*?<\/div>/g,
		)!;
		expect(boxes).toHaveLength(3);
		// The caption is the first thing in the box, before the list.
		for (const box of boxes) {
			expect(box.indexOf("section-prep")).toBeGreaterThan(-1);
			expect(box.indexOf("section-prep")).toBeLessThan(box.indexOf("<ul>"));
			expect(box).toContain("Mise en place</span>");
		}
	});

	it("shows the duration only on hover, never as visible text", () => {
		const tips = [
			...html.matchAll(
				/<p class="section-prep"><span data-tooltip="([^"]*)">([\s\S]*?)<\/span>/g,
			),
		];
		expect(tips).toHaveLength(3);
		tips.forEach((m, i) => {
			const minutes = fmt(compiled.miseEnPlace[i]!.duration);
			expect(m[1]).toContain(`: ${minutes} —`);
			expect(m[2]).not.toMatch(/\d+\s?m\b|\d+\s?min/);
		});
	});

	it("keeps the duration out of the section title, where it would read as the section's total time", () => {
		for (const h3 of html.match(/<h3 class="section-header[\s\S]*?<\/h3>/g)!) {
			expect(h3).not.toContain("Mise en place");
			expect(h3).not.toContain("gicon-knife");
		}
	});

	it("never uses an h4 (gram.css hides it) nor a nested div (it would cut a </div> split)", () => {
		const out = toHTML(compiled);
		expect(out).not.toContain("<h4");
		expect(out).not.toMatch(/<div class="section-ingredients">\s*<div/);
	});

	it("lets a section without an ingredient list carry the label on its own", () => {
		const out = toHTML(compile(getAST("## Heat\n\nHeat a #pan.\n")));
		expect(out).toContain('<div class="section-prep"><span data-tooltip=');
		expect(out).not.toContain("section-ingredients");
	});

	it("has no up-front block", () => {
		expect(html).not.toContain('class="mise-en-place"');
	});

	it("reads total and idle time from the per-section schedule", () => {
		const { totalTime, idleTime } = schedulesOf(compiled).perSection;
		expect(html).toContain(`<div class="meta-value">${fmt(totalTime)}</div>`);
		expect(html).toContain(`<div class="meta-value">${fmt(idleTime)}</div>`);
	});

	it("is the default", () => {
		expect(toHTML(compiled, { schedule: "perSection" })).toBe(html);
	});
});

describe("HTML — upfront", () => {
	const html = toHTML(compiled, { schedule: "upfront" });

	it("gathers the mise en place in one block before the first section", () => {
		expect(countOf(html, 'class="mise-en-place-session"')).toBe(1);
		expect(html.indexOf('class="mise-en-place-session"')).toBeLessThan(
			html.indexOf("<section>"),
		);
		// One session: nothing to tell days apart.
		expect(html).not.toContain("D-");
		// Each section's own line.
		const block = html.match(
			/<section class="mise-en-place-session">[\s\S]*?<\/section>/,
		)![0];
		expect(block).toContain("<em>Dough</em>: ");
		expect(block).toContain("Preparation: onions");
	});

	it("keeps a per-section label only for what has to wait (the intermediates)", () => {
		// Assembly weighs out &filling and &dough, which don't exist at the start.
		expect(countOf(html, '<p class="section-prep">')).toBe(1);
	});

	it("reads total and idle time from the upfront schedule", () => {
		const { totalTime, idleTime } = schedulesOf(compiled).upfront;
		expect(html).toContain(`<div class="meta-value">${fmt(totalTime)}</div>`);
		expect(html).toContain(`<div class="meta-value">${fmt(idleTime)}</div>`);
	});
});

describe("both schedules describe the same recipe", () => {
	// The setting is about time: the ingredient lists must not depend on it.
	const withoutLabels = (html: string) =>
		html
			.replace(
				/<section class="mise-en-place-session">[\s\S]*?<\/section>\s*/g,
				"",
			)
			.replace(/<p class="section-prep">[\s\S]*?<\/p>\s*/g, "")
			.replace(/<div class="section-prep">[\s\S]*?<\/div>\s*/g, "");
	const listsOf = (html: string) =>
		html.slice(
			html.indexOf('<div class="instructions"'),
			html.lastIndexOf("</div>") + 6,
		);

	it("keeps every ingredient list identical, apart from the per-section label", () => {
		expect(
			withoutLabels(listsOf(toHTML(compiled, { schedule: "upfront" }))),
		).toBe(
			withoutLabels(listsOf(toHTML(compiled, { schedule: "perSection" }))),
		);
	});

	it("keeps the shopping list identical", () => {
		expect(shoppingList(toHTML(compiled, { schedule: "upfront" }))).toBe(
			shoppingList(toHTML(compiled, { schedule: "perSection" })),
		);
	});

	it("keeps preparation and active time the same", () => {
		const a = toHTML(compiled, { schedule: "perSection" });
		const b = toHTML(compiled, { schedule: "upfront" });
		for (const v of [
			fmt(compiled.metrics.preparationTime),
			fmt(compiled.metrics.activeTime),
		]) {
			expect(a).toContain(v);
			expect(b).toContain(v);
		}
	});
});

describe("backend parity", () => {
	const backends = {
		html: (o: object) => toHTML(compiled, o),
		print: (o: object) => toPrintHTML(compiled, o),
		markdown: (o: object) => toMarkdown(compiled, o),
	};

	for (const [name, render] of Object.entries(backends)) {
		it(`${name}: the two schedules differ by time only, never by an ingredient list`, () => {
			const strip = (out: string) =>
				out
					.replace(/\d+h( \d+m)?|\d+m\b/g, "T")
					.replace(
						/<section class="mise-en-place-session">[\s\S]*?<\/section>\s*/g,
						"",
					)
					.replace(/\*\*Mise en place[^\n]*\n\n(- [^\n]*\n)+\n/g, "")
					.replace(/<p class="section-prep">[\s\S]*?<\/p>\s*/g, "");
			expect(strip(render({ schedule: "upfront" }))).toBe(
				strip(render({ schedule: "perSection" })),
			);
		});
	}

	it("markdown and print show no mise en place by section, just the times", () => {
		for (const render of [backends.markdown, backends.print]) {
			const out = render({ schedule: "perSection" });
			expect(out).not.toMatch(
				/mise-en-place"|## 🔪|section-prep|🔪 Mise en place/,
			);
			expect(out).not.toContain("Ingredients lookup");
		}
	});

	it("markdown and print take their totals from the chosen schedule", () => {
		const up = schedulesOf(compiled).upfront.totalTime;
		const per = schedulesOf(compiled).perSection.totalTime;
		expect(up).not.toBe(per);
		expect(toMarkdown(compiled, { schedule: "upfront" })).toContain(fmt(up));
		expect(toMarkdown(compiled, { schedule: "perSection" })).toContain(
			fmt(per),
		);
		expect(toPrintHTML(compiled, { schedule: "upfront" })).toContain(fmt(up));
		expect(toPrintHTML(compiled, { schedule: "perSection" })).toContain(
			fmt(per),
		);
	});
});

describe("Gantt", () => {
	const prepBlocks = (html: string) =>
		[...html.matchAll(/<div class="time-block[^"]*\bprep\b[^"]*"[^>]*>/g)].map(
			(m) => m[0],
		);
	const attr = (tag: string, name: string) =>
		Number(tag.match(new RegExp(`data-${name}="([^"]*)"`))?.[1]);

	it("draws one preparation block per section with a cost, in the section colour", () => {
		const html = toGanttHTML(compiled);
		const blocks = prepBlocks(html);
		expect(blocks).toHaveLength(3);
		expect(blocks[0]).toContain("section-color-0");
		expect(blocks[1]).toContain("section-color-1");
		expect(blocks[2]).toContain("section-color-2");
		expect(blocks[0]).toContain('data-label="Mise en place"');
	});

	it("puts the second preparation during the dough's rest, not at T0", () => {
		const [first, second] = prepBlocks(toGanttHTML(compiled));
		expect(attr(first!, "start")).toBe(0);
		expect(attr(second!, "start")).toBeGreaterThan(30);
	});

	it("puts every preparation at the start in upfront, end to end", () => {
		const [first, second] = prepBlocks(
			toGanttHTML(compiled, { schedule: "upfront" }),
		);
		expect(attr(first!, "start")).toBe(0);
		expect(attr(second!, "start")).toBe(attr(first!, "end"));
	});

	it("spans the chosen schedule's total time", () => {
		for (const mode of ["perSection", "upfront"] as const) {
			const html = toGanttHTML(compiled, { schedule: mode });
			expect(html).toContain(
				`data-max-real-time="${schedulesOf(compiled)[mode].totalTime}"`,
			);
		}
	});

	it("describes the preparation in the block's tooltip", () => {
		const [first] = prepBlocks(toGanttHTML(compiled));
		expect(first).toContain("data-tooltip=");
		expect(first).toContain("Ingredients lookup");
	});
});

// Day -3: a cream that rests; day -1: a crust made from it, then the pie; the
// last section has no anchor, so it falls on the day itself.
const MULTI_DAY = `## Cream ~{-3d} ->&cream

Whisk @milk{500ml} and @eggs{4}.

[Rest] Chill ~_{12h}.

## Crust ~{-1d} ->&crust

Mix &cream{100g} and @flour{200g}.

## Pie ~{-1d}

Fill with &crust{300g} and bake ~{30min}.

## Serve

Dust with @sugar{10g}.
`;

describe("perSession", () => {
	const multi = compile(getAST(MULTI_DAY));
	const options = { schedule: "perSession" } as const;

	it("opens each working day with its mise en place, labelled D-N", () => {
		const html = toHTML(multi, options);
		expect(countOf(html, 'class="mise-en-place-session"')).toBe(3);
		expect(html).toContain("Mise en place — D-3");
		expect(html).toContain("Mise en place — D-1");
		expect(html).toContain("Mise en place — Day D");
		expect(html.indexOf("D-3")).toBeLessThan(html.indexOf("D-1"));
		expect(html.indexOf("D-1")).toBeLessThan(html.indexOf("Day D"));
	});

	it("says Jour J in French for the day itself", () => {
		const html = toHTML(
			compile(
				getAST(
					"## Prep ~{-2d}\n\nChop @onions{1}.\n\n## Cook\n\nFry @butter{10g}.\n",
				),
			),
			{ ...options, lang: "fr" },
		);
		expect(html).toContain("Mise en place — J-2");
		expect(html).toContain("Mise en place — Jour J");
	});

	it("gathers on day D-1 what the crust needs from D-3, and defers the same-day intermediate", () => {
		const html = toHTML(multi, options);
		const day1 = html.slice(html.indexOf("D-1"), html.indexOf("Day D"));
		expect(day1).toContain("<em>Crust</em>");
		// &crust is made on D-1 and used by the pie: not gathered at the head of
		// the day, but labelled in the pie's own section.
		expect(day1).not.toContain("<em>Pie</em>");
		expect(countOf(html, '<p class="section-prep">')).toBe(1);
	});

	it("writes the same blocks in markdown and print", () => {
		const md = toMarkdown(multi, options);
		expect(md).toContain("**Mise en place — D-3**");
		expect(md).toContain("**Mise en place — D-1**");
		expect(md).toContain("**Mise en place — Day D**");
		const print = toPrintHTML(multi, options);
		expect(print).toContain("Mise en place — D-3");
		expect(print).toContain("Mise en place — D-1");
	});

	it("escapes a section title written in the block", () => {
		const evil = compile(
			getAST(
				"## <img src=x onerror=alert(1)> ~{-1d}\n\nChop @onions{1}.\n\n## Cook\n\nFry @butter{10g}.\n",
			),
		);
		for (const out of [toHTML(evil, options), toPrintHTML(evil, options)]) {
			expect(out).not.toContain("<img src=x");
		}
	});

	it("marks each day on the Gantt and keeps block ids unique", () => {
		const html = toGanttHTML(multi, options);
		expect(html).toContain(">D-3<");
		expect(html).toContain(">D-1<");
		expect(countOf(html, 'class="gantt-marker session-marker"')).toBe(2);
		const ids = buildTracks(multi, options).tracks.flatMap((t) =>
			t.blocks.map((b) => b.id),
		);
		expect(ids.some((id) => id.endsWith("_later"))).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("is a single session, without day labels, when no section is anchored a day back", () => {
		const html = toHTML(compiled, options);
		expect(countOf(html, 'class="mise-en-place-session"')).toBe(1);
		expect(html).not.toContain("D-");
	});
});

describe("data without schedules", () => {
	it("still renders, without a badge or a block", () => {
		const { schedules: _s, miseEnPlace: _m, ...legacy } = compiled;
		const html = toHTML(legacy as never);
		expect(html).not.toContain("section-prep");
		expect(html).not.toContain('class="mise-en-place"');
	});
});

// The recipe above has no `formatDuration` override, so the default one applies.
function fmt(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
	return `${m}m`;
}

describe("mise en place wording", () => {
	// The preparation card lists each line with its duration in a column of its
	// own; the tooltips that have no such column spell it out.
	it("does not give a preparation's duration twice on the preparation card", () => {
		const html = toHTML(compiled);
		expect(html).toContain('timing-detail-type">Preparation: onions</span>');
		expect(html).not.toContain('timing-detail-type">Preparation: onions (+');
	});

	it("still gives it where there is no column, in the Gantt block's tooltip", () => {
		const tooltips = toGanttHTML(compiled).match(/data-tooltip="[^"]*"/g) ?? [];
		expect(tooltips.some((t) => t.includes("Preparation: onions (+ 2m)"))).toBe(
			true,
		);
	});

	it("puts no space before the colon in English, one in French", () => {
		const en = toHTML(compiled, { lang: "en" });
		const fr = toHTML(compiled, { lang: "fr" });
		expect(en).toContain("Mise en place for this section: ");
		expect(fr).toContain("Mise en place de cette section : ");
		expect(fr).toContain("Préparation : ");
		expect(en).not.toContain("Preparation : ");
	});

	it("writes the gathering unit with the caller's duration format", () => {
		const html = toHTML(compiled, { formatDuration: (m) => `${m} min` });
		expect(html).toContain("(2 × 1 min)");
		expect(html).not.toContain("× 1min");
	});
});
