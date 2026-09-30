import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	compile,
	isDurationTooLong,
	MAX_DURATION_MINUTES,
	maxDurationIn,
	quantityToMinutes,
	WarningCode,
	warningSeverity,
} from "../src/index";

/*
 * A duration past `MAX_DURATION_MINUTES` (1000 years) used to come out as 0
 * minutes, `Infinity` or `NaN` (which is `null` in the compiled JSON), without
 * a word. It is now capped, with `DURATION_OUT_OF_RANGE`. The limit is a
 * technical bound: nothing up to it may be touched.
 */

const YEAR = 365 * 24 * 60;
const COMPILED = (source: string) => compile(getAST(source));
const retro = (offset: string) =>
	COMPILED(`## A ~{${offset}}\n\nMix @flour{1g}.\n\n## B\n\nAdd @salt{1g}.\n`);
const timer = (marker: string, duration: string) =>
	COMPILED(
		`## A\n\nMix @flour{1g} ${marker}{${duration}}.\n\n## B\n\nAdd @salt{1g}.\n`,
	);
const codes = (r: ReturnType<typeof compile>) => r.warnings.map((w) => w.code);

/** No time in the compiled schedules is missing, infinite or `null` once serialized. */
function expectFiniteTimes(r: ReturnType<typeof compile>) {
	for (const mode of ["perSection", "upfront"] as const) {
		const s = r.schedules[mode];
		for (const n of [s.totalTime, s.idleTime])
			expect(Number.isFinite(n)).toBe(true);
		for (const b of s.blocks) {
			expect(Number.isFinite(b.start) && Number.isFinite(b.end)).toBe(true);
		}
	}
	expect(JSON.stringify(r.schedules)).not.toContain("null");
	expect(JSON.stringify(r.metrics)).not.toContain("null");
}

describe("the longest duration", () => {
	it("is 1000 years", () => {
		expect(MAX_DURATION_MINUTES).toBe(1000 * YEAR);
	});

	it("leaves every duration up to it alone, the limit itself included", () => {
		for (const offset of ["-2d", "-36500d", "-365000d"]) {
			const r = retro(offset);
			expect(codes(r)).not.toContain(WarningCode.DURATION_OUT_OF_RANGE);
			expectFiniteTimes(r);
		}
		const edge = retro("-365000d");
		expect(edge.sections[0]?.retro_planning?.minutes).toBe(
			-MAX_DURATION_MINUTES,
		);
		expect(edge.sections[0]?.retro_planning?.value).toBe(365000);
	});
});

describe("a retro-planning offset past the limit", () => {
	it("is capped, flagged once, and keeps what was written", () => {
		const r = retro("-365001d");
		const rp = r.sections[0]?.retro_planning;
		expect(
			codes(r).filter((c) => c === WarningCode.DURATION_OUT_OF_RANGE),
		).toHaveLength(1);
		expect(rp?.minutes).toBe(-MAX_DURATION_MINUTES);
		// What is kept agrees with the duration the schedule was built on...
		expect(rp?.value).toBe(365000);
		expect(rp?.unit).toBe("d");
		// ...and the text as written stays available.
		expect(rp?.raw).toContain("365001");
		expectFiniteTimes(r);
	});

	it("points at the section and says what happened", () => {
		const w = retro("-999999d").warnings.find(
			(x) => x.code === WarningCode.DURATION_OUT_OF_RANGE,
		);
		expect(w?.message).toContain("longer than 1000 years");
		expect(w?.message).toContain("capped");
		expect(w?.loc).toBeDefined();
		expect(warningSeverity[WarningCode.DURATION_OUT_OF_RANGE]).toBe("warning");
	});

	it("turns the values that used to break the timeline into the same capped one", () => {
		// 1e15 days lost all precision (0 minutes); 1e309 is Infinity; both gave NaN.
		const expected = retro("-365001d").schedules.perSection.totalTime;
		for (const digits of [
			"1" + "0".repeat(15),
			"9".repeat(24),
			"9".repeat(309),
			"9".repeat(400),
		]) {
			const r = retro(`-${digits}d`);
			expect(codes(r)).toContain(WarningCode.DURATION_OUT_OF_RANGE);
			expect(r.schedules.perSection.totalTime).toBe(expected);
			expectFiniteTimes(r);
		}
	});

	it("does the same in minutes, the smallest unit", () => {
		const r = retro(`-${"9".repeat(40)}min`);
		expect(codes(r)).toContain(WarningCode.DURATION_OUT_OF_RANGE);
		expect(r.sections[0]?.retro_planning?.minutes).toBe(-MAX_DURATION_MINUTES);
		expectFiniteTimes(r);
	});
});

describe("a timer past the limit", () => {
	for (const [label, marker] of [
		["active", "~"],
		["passive", "~_"],
		["named passive", "~_oven"],
	] as const) {
		it(`is capped and flagged (${label})`, () => {
			const r = timer(marker, `${"9".repeat(20)}h`);
			expect(codes(r)).toContain(WarningCode.DURATION_OUT_OF_RANGE);
			const step = r.sections[0]?.steps[0];
			const token =
				step?.type === "step"
					? step.content.find(
							(t) => typeof t === "object" && "type" in t && t.type === "timer",
						)
					: undefined;
			// The quantity kept is the capped one, in the unit written.
			expect(token && "quantity" in token ? token.quantity : undefined).toBe(
				maxDurationIn("h"),
			);
			expectFiniteTimes(r);
		});
	}

	it("copes with a number beyond what a double holds", () => {
		const r = timer("~_", `${"9".repeat(400)}h`);
		expect(codes(r)).toContain(WarningCode.DURATION_OUT_OF_RANGE);
		expectFiniteTimes(r);
	});

	it("leaves an ordinary timer alone", () => {
		const r = timer("~", "1h");
		expect(codes(r)).not.toContain(WarningCode.DURATION_OUT_OF_RANGE);
		expect(r.metrics.activeTime).toBe(62);
	});
});

describe("quantityToMinutes", () => {
	it("caps what it returns, in both directions, for every consumer", () => {
		expect(quantityToMinutes({ value: 1e30, unit: "d" })).toBe(
			MAX_DURATION_MINUTES,
		);
		expect(quantityToMinutes({ value: -1e30, unit: "h" })).toBe(
			-MAX_DURATION_MINUTES,
		);
		expect(
			quantityToMinutes({ value: Number.POSITIVE_INFINITY, unit: "min" }),
		).toBe(MAX_DURATION_MINUTES);
	});

	it("is exact below the limit", () => {
		expect(quantityToMinutes({ value: 2, unit: "h" })).toBe(120);
		expect(quantityToMinutes({ value: 365000, unit: "d" })).toBe(
			MAX_DURATION_MINUTES,
		);
	});

	it("says whether a duration is past the limit", () => {
		expect(isDurationTooLong({ value: 365000, unit: "d" })).toBe(false);
		expect(isDurationTooLong({ value: 365001, unit: "d" })).toBe(true);
		expect(
			isDurationTooLong({ value: Number.POSITIVE_INFINITY, unit: "s" }),
		).toBe(true);
		expect(isDurationTooLong(null)).toBe(false);
	});
});
