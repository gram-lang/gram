import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	compile,
	DEFAULT_MISE_EN_PLACE_MODE,
	isMiseEnPlaceMode,
	MISE_EN_PLACE_MODES,
	scheduleFor,
	scheduleTimes,
} from "../src/index";

// The three timelines of a compiled recipe, laid out from its task graph.
const schedulesOf = (c: Parameters<typeof scheduleFor>[0]) => ({
	perSection: scheduleFor(c, "perSection")!,
	upfront: scheduleFor(c, "upfront")!,
	perSession: scheduleFor(c, "perSession")!,
});

describe("schedule modes", () => {
	it("knows every mode, and defaults to preparing right before each section", () => {
		expect([...MISE_EN_PLACE_MODES]).toEqual([
			"perSection",
			"upfront",
			"perSession",
		]);
		expect(DEFAULT_MISE_EN_PLACE_MODE).toBe("perSection");
	});

	it("accepts only a known mode", () => {
		expect(isMiseEnPlaceMode("upfront")).toBe(true);
		expect(isMiseEnPlaceMode("perSection")).toBe(true);
		for (const bad of ["per-section", "", "UPFRONT", null, undefined, 1, {}]) {
			expect(isMiseEnPlaceMode(bad)).toBe(false);
		}
	});

	it("reads the chosen timeline, the default one when none is given", () => {
		const result = compile(
			getAST("## A ~{-2d}\n\nMix @flour{1g}.\n\n## B\n\nBake @egg{1}.\n"),
		);
		expect(scheduleFor(result)).toBe(schedulesOf(result).perSection);
		expect(scheduleFor(result, "perSection")).toBe(
			schedulesOf(result).perSection,
		);
		expect(scheduleFor(result, "upfront")).toBe(schedulesOf(result).upfront);
	});

	it("returns nothing for data without tasks instead of throwing", () => {
		expect(scheduleFor({})).toBeUndefined();
		expect(scheduleFor({ tasks: undefined }, "upfront")).toBeUndefined();
	});

	describe("scheduleTimes", () => {
		const result = compile(
			getAST("## A ~{-2d}\n\nMix @flour{1g}.\n\n## B\n\nBake @egg{1}.\n"),
		);

		it("reads total and idle time of the chosen timeline", () => {
			for (const mode of MISE_EN_PLACE_MODES) {
				expect(scheduleTimes(result, mode)).toEqual({
					totalTime: schedulesOf(result)[mode].totalTime,
					idleTime: schedulesOf(result)[mode].idleTime,
				});
			}
			expect(scheduleTimes(result)).toEqual(
				scheduleTimes(result, "perSection"),
			);
		});

		it("falls back on the deprecated metrics for JSON without tasks", () => {
			const { schedule: _s, tasks: _t, ...stored } = result;
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
