import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	compile,
	DEFAULT_SCHEDULE_MODE,
	isScheduleMode,
	SCHEDULE_MODES,
	scheduleFor,
	scheduleTimes,
} from "../src/index";

describe("schedule modes", () => {
	it("knows both modes, and defaults to preparing right before each section", () => {
		expect([...SCHEDULE_MODES]).toEqual(["perSection", "upfront"]);
		expect(DEFAULT_SCHEDULE_MODE).toBe("perSection");
	});

	it("accepts only a known mode", () => {
		expect(isScheduleMode("upfront")).toBe(true);
		expect(isScheduleMode("perSection")).toBe(true);
		for (const bad of ["per-section", "", "UPFRONT", null, undefined, 1, {}]) {
			expect(isScheduleMode(bad)).toBe(false);
		}
	});

	it("reads the chosen timeline, the default one when none is given", () => {
		const result = compile(
			getAST("## A ~{-2d}\n\nMix @flour{1g}.\n\n## B\n\nBake @egg{1}.\n"),
		);
		expect(scheduleFor(result)).toBe(result.schedules.perSection);
		expect(scheduleFor(result, "perSection")).toBe(result.schedules.perSection);
		expect(scheduleFor(result, "upfront")).toBe(result.schedules.upfront);
	});

	it("returns nothing for data without schedules instead of throwing", () => {
		expect(scheduleFor({})).toBeUndefined();
		expect(scheduleFor({ schedules: undefined }, "upfront")).toBeUndefined();
	});

	describe("scheduleTimes", () => {
		const result = compile(
			getAST("## A ~{-2d}\n\nMix @flour{1g}.\n\n## B\n\nBake @egg{1}.\n"),
		);

		it("reads total and idle time of the chosen timeline", () => {
			for (const mode of SCHEDULE_MODES) {
				expect(scheduleTimes(result, mode)).toEqual({
					totalTime: result.schedules[mode].totalTime,
					idleTime: result.schedules[mode].idleTime,
				});
			}
			expect(scheduleTimes(result)).toEqual(
				scheduleTimes(result, "perSection"),
			);
		});

		it("falls back on the deprecated metrics for JSON without schedules", () => {
			const { schedules: _s, ...stored } = result;
			expect(scheduleTimes(stored)).toEqual({
				totalTime: result.metrics.totalTime,
				idleTime: result.metrics.idleTime,
			});
		});

		it("gives 0 when there is nothing to read at all", () => {
			expect(scheduleTimes({})).toEqual({ totalTime: 0, idleTime: 0 });
		});
	});
});
