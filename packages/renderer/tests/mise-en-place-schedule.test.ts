import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { toGanttHTML, toHTML, toMarkdown, toPrintHTML } from "../src/index";

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
		const { totalTime, idleTime } = compiled.schedules.perSection;
		expect(html).toContain(`<div class="meta-value">${fmt(totalTime)}</div>`);
		expect(html).toContain(`<div class="meta-value">${fmt(idleTime)}</div>`);
	});

	it("is the default", () => {
		expect(toHTML(compiled, { schedule: "perSection" })).toBe(html);
	});
});

describe("HTML — upfront", () => {
	const html = toHTML(compiled, { schedule: "upfront" });

	it("has one 'Mise en place' block, before the instructions and after the cookware", () => {
		expect(countOf(html, 'class="mise-en-place"')).toBe(1);
		const block = html.indexOf('class="mise-en-place"');
		expect(block).toBeGreaterThan(html.indexOf('class="cookware"'));
		expect(block).toBeLessThan(html.indexOf('class="instructions"'));
	});

	it("lists what has to be prepared, and not the intermediates", () => {
		const block = html.slice(
			html.indexOf('class="mise-en-place"'),
			html.indexOf('class="instructions"'),
		);
		expect(block).toContain("onions");
		expect(block).toContain("finely sliced");
		expect(block).toContain("butter");
		expect(block).not.toContain("flour");
		expect(block).not.toContain("dough");
		expect(block).not.toContain("filling");
	});

	it("keeps the block scalable like any other ingredient list", () => {
		const block = html.slice(
			html.indexOf('class="mise-en-place"'),
			html.indexOf('class="instructions"'),
		);
		expect(block).toContain('data-name="onions"');
	});

	it("has no per-section badge", () => {
		expect(html).not.toContain("section-prep");
	});

	it("reads total and idle time from the upfront schedule", () => {
		const { totalTime, idleTime } = compiled.schedules.upfront;
		expect(html).toContain(`<div class="meta-value">${fmt(totalTime)}</div>`);
		expect(html).toContain(`<div class="meta-value">${fmt(idleTime)}</div>`);
	});
});

describe("both schedules describe the same recipe", () => {
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
		it(`${name}: upfront shows one block listing the preparations`, () => {
			const out = render({ schedule: "upfront" });
			expect(out).toMatch(/mise-en-place"|## 🔪/);
			expect(out).toContain("onions");
		});
	}

	it("markdown and print show no mise en place block by section, just the times", () => {
		for (const render of [backends.markdown, backends.print]) {
			const out = render({ schedule: "perSection" });
			expect(out).not.toMatch(
				/mise-en-place"|## 🔪|section-prep|🔪 Mise en place/,
			);
			expect(out).not.toContain("Ingredients lookup");
		}
	});

	it("markdown and print take their totals from the chosen schedule", () => {
		const up = compiled.schedules.upfront.totalTime;
		const per = compiled.schedules.perSection.totalTime;
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
				`data-max-real-time="${compiled.schedules[mode].totalTime}"`,
			);
		}
	});

	it("describes the preparation in the block's tooltip", () => {
		const [first] = prepBlocks(toGanttHTML(compiled));
		expect(first).toContain("data-tooltip=");
		expect(first).toContain("Ingredients lookup");
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
