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
	it("has a mise en place for two of the three sections", () => {
		expect(compiled.miseEnPlace.map((m) => m.section)).toEqual([0, 1]);
	});
});

describe("HTML — perSection (default)", () => {
	const html = toHTML(compiled);

	it("puts a duration badge in each section that has a mise en place", () => {
		expect(countOf(html, 'class="section-prep"')).toBe(2);
		expect(html).toContain("section-meta-prep");
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
		expect(html).not.toContain('class="section-prep"');
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
		it(`${name}: perSection shows the mise en place of the sections, not a block`, () => {
			const out = render({ schedule: "perSection" });
			expect(out).toContain("Mise en place");
			expect(out).not.toMatch(/mise-en-place"|## 🔪/);
		});

		it(`${name}: upfront shows one block listing the preparations`, () => {
			const out = render({ schedule: "upfront" });
			expect(out).toMatch(/mise-en-place"|## 🔪/);
			expect(out).toContain("onions");
		});
	}

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
		expect(blocks).toHaveLength(2);
		expect(blocks[0]).toContain("section-color-0");
		expect(blocks[1]).toContain("section-color-1");
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
		expect(html).not.toContain('class="section-prep"');
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
