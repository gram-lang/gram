import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { type GanttRenderOptions, toGanttHTML } from "../src/index";

/*
 * `gapThresholdMinutes` and `compressedGapSize` decide how a long wait is
 * squeezed on the time axis. The chart's width, the ticks, the zig-zag overlays
 * and every block's position are all derived from them, so they have to be
 * derived from the same two numbers: one stray default and the blocks no longer
 * fit the width they are a percentage of.
 */

// Two hours of rest in the middle: one long idle gap.
const RECIPE = `## Dough

Mix @flour{500g}.

[Rest] Let it rest ~_{2h}.

## Bake

Bake @egg{1} for ~{20min}.
`;
const compiled = compile(getAST(RECIPE));

const render = (options: GanttRenderOptions = {}) =>
	toGanttHTML(compiled, options);

/** The chart's width in px: it grows with the time it has to show. */
const widthOf = (html: string) =>
	Number(/min-width:max\(600px, ([\d.]+)px\)/.exec(html)?.[1]);

/** Right edge, in % of the chart, of the block that reaches furthest. */
const rightmostEdge = (html: string) =>
	Math.max(
		...[
			...html.matchAll(
				/class="time-block[^"]*"[^>]*style="[^"]*left:([\d.]+)%;width:([\d.]+)%/g,
			),
		].map((m) => Number(m[1]) + Number(m[2])),
	);

const overlays = (html: string) =>
	(html.match(/class="visual-gap"/g) ?? []).length;

describe("gantt: gapThresholdMinutes", () => {
	it("keeps the defaults when nothing is passed", () => {
		expect(overlays(render())).toBeGreaterThan(0);
		expect(rightmostEdge(render())).toBeCloseTo(100, 6);
	});

	it("leaves a wait uncompressed when it is shorter than the threshold", () => {
		const html = render({ gapThresholdMinutes: 600 });
		expect(overlays(html)).toBe(0);
		// Nothing squeezed: the chart is as wide as the real time, and the
		// blocks still fit it (they used to run to 280% of it).
		expect(widthOf(html)).toBeGreaterThan(widthOf(render()));
		expect(rightmostEdge(html)).toBeCloseTo(100, 6);
	});

	it("changes nothing for a wait that is already over a lower threshold", () => {
		// 2 h of rest is a gap under either threshold: same chart.
		expect(widthOf(render({ gapThresholdMinutes: 30 }))).toBe(
			widthOf(render()),
		);
	});
});

describe("gantt: compressedGapSize", () => {
	it("sets how wide a compressed wait is left", () => {
		const narrow = render({ compressedGapSize: 5 });
		const wide = render({ compressedGapSize: 60 });
		expect(widthOf(narrow)).toBeLessThan(widthOf(render()));
		expect(widthOf(wide)).toBeGreaterThan(widthOf(render()));
		for (const html of [narrow, wide]) {
			expect(rightmostEdge(html)).toBeCloseTo(100, 6);
			expect(overlays(html)).toBe(overlays(render()));
		}
	});

	it("never stretches a wait: a size above the gap leaves it as it is", () => {
		const huge = render({ compressedGapSize: 10_000 });
		const uncompressed = render({ gapThresholdMinutes: 10_000 });
		expect(widthOf(huge)).toBe(widthOf(uncompressed));
		expect(rightmostEdge(huge)).toBeCloseTo(100, 6);
	});
});

describe("gantt: infinite gap options", () => {
	it('read as "never compress"', () => {
		const uncompressed = render({ gapThresholdMinutes: 10_000 });
		expect(render({ gapThresholdMinutes: Number.POSITIVE_INFINITY })).toBe(
			uncompressed,
		);
		expect(render({ compressedGapSize: Number.POSITIVE_INFINITY })).toBe(
			render({ compressedGapSize: 10_000 }),
		);
	});
});

describe("gantt: unusable gap options", () => {
	it("fall back on the defaults", () => {
		const expected = render();
		for (const options of [
			{ gapThresholdMinutes: Number.NaN },
			{ gapThresholdMinutes: -5 },
			{ compressedGapSize: Number.NaN },
			{ compressedGapSize: -20 },
		]) {
			expect(render(options)).toBe(expected);
		}
	});
});
