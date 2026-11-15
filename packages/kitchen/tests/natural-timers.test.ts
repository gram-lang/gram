import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile, WarningCode } from "../src/index";

const compileStep = (step: string) => compile(getAST(`## Mix\n\n${step}\n`));

/** The first timer of a one-step recipe, and the compile warnings. */
const timer = (src: string) => {
	const result = compileStep(`Cook ${src}.`);
	const token = result.sections[0]?.steps[0]?.content.find(
		(c) => typeof c === "object" && "type" in c && c.type === "timer",
	);
	return { token: token as Record<string, unknown>, warnings: result.warnings };
};

const anchor = (header: string) => {
	const result = compile(getAST(`## Dough ${header}\n\nKnead.\n`));
	return { rp: result.sections[0]?.retro_planning, warnings: result.warnings };
};

const codes = (warnings: { code: string }[]) => warnings.map((w) => w.code);

/** A few words each INVALID_DURATION message carries, by reason. */
const HINTS: Record<string, string> = {
	ambiguousClock: "hours or minutes",
	unitOrder: "largest to the smallest",
	overflow60: "under 60",
	ambiguousRange: "both sides in full",
	reversedRange: "starts with the shorter",
	multiplication: "[Repeat]",
	iso8601: "ISO 8601",
	words: "numbers and units only",
	anchorRange: "not a range",
	anchorSeconds: "days, hours and minutes",
};

describe("natural timers", () => {
	it.each([
		["~{1h30}", 90],
		["~{1 h 30}", 90],
		["~{1hr 30 mins}", 90],
		["~{1 hour 30 minutes}", 90],
		["~{1 heure 30}", 90],
		["~{1h + 30min}", 90],
		["~{1:30 h}", 90],
		["~{1:30:00}", 90],
		["~{0:04:30}", 4.5],
		["~{4:30 min}", 4.5],
		["~{5'30\"}", 5.5],
		["~{2min30}", 2.5],
		["~_{2 j 4 h}", 52 * 60],
	])("reads %s as %d minutes", (src, minutes) => {
		const { token, warnings } = timer(src);
		// A long rest may push the plan out of its day: not a duration warning.
		expect(
			codes(warnings).filter((c) => c !== WarningCode.DAY_OVERFLOW),
		).toEqual([]);
		expect(token.minutes).toBe(minutes);
	});

	it("keeps what was written in raw", () => {
		expect(timer("~{ 1h30 }").token.raw).toBe("1h30");
	});

	it("gives a compound duration in the smallest unit written", () => {
		expect(timer("~{1h20}").token).toEqual({
			type: "timer",
			raw: "1h20",
			quantity: { type: "single", value: 80 },
			unit: "min",
			minutes: 80,
		});
		expect(timer("~{5'30\"}").token).toMatchObject({
			quantity: { type: "single", value: 330 },
			unit: "s",
			minutes: 5.5,
		});
	});

	it("leaves the quantity of a timer written as before untouched", () => {
		expect(timer("~{1.5h}").token).toEqual({
			type: "timer",
			raw: "1.5h",
			quantity: { type: "single", value: 1.5, text: "1.5" },
			unit: "h",
			minutes: 90,
		});
		expect(timer("~_{1-2 h}").token).toMatchObject({
			isPassive: true,
			quantity: { type: "range", range: { min: 1, max: 2 } },
			unit: "h",
			minutes: 90,
		});
	});

	it("gives a compound range in the smallest unit of both sides", () => {
		expect(timer("~{1h30-2h}").token).toMatchObject({
			quantity: { type: "range", value: 105, range: { min: 90, max: 120 } },
			unit: "min",
			minutes: 105,
		});
	});

	it("plans a compound timer like any other", () => {
		const plain = compileStep("Cook ~{90 min}.");
		const compound = compileStep("Cook ~{1h30}.");
		expect(compound.sections[0]?.steps[0]?.timings).toEqual(
			plain.sections[0]?.steps[0]?.timings,
		);
		expect(compound.schedule).toEqual(plain.schedule);
	});

	it("plans a compound range on its sides", () => {
		const plain = compileStep("Rest ~_{90-120 min}.");
		const compound = compileStep("Rest ~_{1h30-2h}.");
		expect(compound.schedule).toEqual(plain.schedule);
	});

	it("keeps a zero duration", () => {
		const { token, warnings } = timer("~{0:00:00}");
		expect(warnings).toEqual([]);
		expect(token.minutes).toBe(0);
	});
});

describe("refused timers", () => {
	it.each([
		["~{1:30}", "ambiguousClock"],
		["~{30min 1h}", "unitOrder"],
		["~{1h75}", "overflow60"],
		["~{1-2h30}", "ambiguousRange"],
		["~{2-1 h}", "reversedRange"],
		["~{2 * 2 min}", "multiplication"],
		["~{PT1H30M}", "iso8601"],
		["~{1 heure et demie}", "words"],
		["~{2 to 3 hours}", "unknownUnit"],
	])("refuses %s", (src, reason) => {
		const { token, warnings } = timer(src);
		const code =
			reason === "unknownUnit"
				? WarningCode.INVALID_UNIT
				: WarningCode.INVALID_DURATION;
		expect(codes(warnings)).toEqual([code]);
		if (code === WarningCode.INVALID_DURATION) {
			expect(warnings[0]?.message).toContain(`"${src.slice(2, -1)}"`);
			expect(warnings[0]?.message).toContain(HINTS[reason] as string);
			expect(warnings[0]?.message).toContain("not counted in the total time");
		}
		// Only what was written is kept: nothing reaches the schedule.
		expect(token).toEqual({ type: "timer", raw: src.slice(2, -1) });
	});

	it("still says INVALID_UNIT for an unknown unit, with the word", () => {
		const { warnings } = timer("~{3 bananas}");
		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.code).toBe(WarningCode.INVALID_UNIT);
		expect(warnings[0]?.message).toBe('Invalid unit "bananas" for Timer.');
	});

	it("still says MISSING_UNIT for a number alone or empty braces", () => {
		expect(codes(timer("~{30}").warnings)).toEqual([WarningCode.MISSING_UNIT]);
		expect(codes(timer("~{}").warnings)).toEqual([WarningCode.MISSING_UNIT]);
	});

	it("counts nothing for a refused timer", () => {
		const refused = compileStep("Cook ~{1:30}.");
		const none = compileStep("Cook.");
		expect(refused.schedule).toEqual(none.schedule);
	});
});

describe("natural section anchors", () => {
	it.each([
		["~{-1h30}", 90, 90, "min"],
		["~{-1j 12h}", 36 * 60, 1.5, "d"],
		["~{-1:30 h}", 90, 90, "min"],
		["~{-2h}", 120, 2, "h"],
	])("reads %s", (header, minutes, value, unit) => {
		const { rp, warnings } = anchor(header);
		expect(warnings).toEqual([]);
		expect(rp).toEqual({
			raw: header.slice(2, -1),
			sign: -1,
			value,
			unit,
			minutes: -minutes,
		});
	});

	it.each([
		["~{-1-2d}", "anchorRange"],
		["~{-1min30}", "anchorSeconds"],
		["~{-1min 30s}", "anchorSeconds"],
		["~{-5'}", "anchorSeconds"],
		["~{-0:04:30}", "anchorSeconds"],
		["~{-1:30}", "ambiguousClock"],
	])("refuses %s with INVALID_DURATION", (header, reason) => {
		const { rp, warnings } = anchor(header);
		expect(codes(warnings)).toEqual([WarningCode.INVALID_DURATION]);
		expect(warnings[0]?.message).toContain(HINTS[reason] as string);
		expect(rp).toEqual({ raw: header.slice(2, -1) });
	});

	it("keeps an anchor written with days in days, so it opens the day before", () => {
		const withDays = compile(
			getAST("## Brine ~{-1j 12h}\n\nBrine.\n\n## Cook\n\nRoast ~{1h}.\n"),
		);
		const decimal = compile(
			getAST("## Brine ~{-1.5d}\n\nBrine.\n\n## Cook\n\nRoast ~{1h}.\n"),
		);
		expect(withDays.warnings).toEqual([]);
		expect(withDays.schedule).toEqual(decimal.schedule);
	});

	it("still says INVALID_UNIT for seconds written as a unit", () => {
		const { rp, warnings } = anchor("~{-30s}");
		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.code).toBe(WarningCode.INVALID_UNIT);
		expect(warnings[0]?.message).toContain('"s"');
		expect(rp).toEqual({ raw: "-30s" });
	});
});
