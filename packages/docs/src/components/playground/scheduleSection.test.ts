import { describe, expect, it } from "bun:test";
import { getDictionary } from "@gram-lang/i18n";
import {
	type ServeSuggestions,
	earliestLabel,
	earliestTooltip,
	isScheduleModified,
	otherCandidates,
	rejectedTooltip,
	scheduleBadgeTitle,
} from "./scheduleSection";

const en = getDictionary("en");
const fr = getDictionary("fr");
const plan = { serveAt: "", timeZone: "UTC", from: "08:00", to: "22:00" };

const suggestions: ServeSuggestions = {
	candidates: [
		{ serveAt: "2026-10-11T13:00", label: "Sun 13:00", title: "Works" },
		{ serveAt: "2026-10-11T20:00", label: "Sun 20:00", title: "Evening" },
	],
	rejected: ["Mon 07:00: too early"],
	earliest: {
		serveAt: "2026-10-11T13:00",
		label: "Sun 13:00",
		text: "Earliest",
	},
};

describe("the schedule section's dot", () => {
	it("is off when nothing differs from the defaults", () => {
		expect(isScheduleModified({})).toBe(false);
		expect(isScheduleModified({ plan })).toBe(false);
		expect(
			isScheduleModified({ plan, schedule: "perSection", rests: "shortest" }),
		).toBe(false);
	});

	it("is on for a serving time, hours by day, a mise en place or rests other than the defaults", () => {
		expect(
			isScheduleModified({ plan: { ...plan, serveAt: "2026-10-11T13:00" } }),
		).toBe(true);
		expect(
			isScheduleModified({ plan: { ...plan, customWeekdays: true } }),
		).toBe(true);
		expect(isScheduleModified({ plan, schedule: "upfront" })).toBe(true);
		expect(isScheduleModified({ plan, rests: "longest" })).toBe(true);
	});

	it("says what changed, in the language asked", () => {
		const state = {
			plan: { ...plan, serveAt: "2026-10-11T13:00", customWeekdays: true },
			schedule: "upfront" as const,
			rests: "longest" as const,
		};
		const title = scheduleBadgeTitle(state, en, "en");
		expect(title.split(" · ")).toHaveLength(4);
		expect(title).toContain("13:00");
		expect(title).toContain(en.renderer.scheduleUpfront);
		expect(title).toContain(en.renderer.restsLongest);
		expect(scheduleBadgeTitle(state, fr, "fr")).toContain(
			fr.renderer.scheduleUpfront,
		);
	});

	it("says the section is active when only the defaults are in use", () => {
		expect(scheduleBadgeTitle({ plan }, en, "en")).toBe(
			en.playground.badges.active,
		);
	});
});

describe("serving time suggestions", () => {
	it("leaves the earliest time out of the others, which have a pill of its own", () => {
		expect(otherCandidates(suggestions).map((c) => c.serveAt)).toEqual([
			"2026-10-11T20:00",
		]);
		expect(otherCandidates({ ...suggestions, earliest: null })).toHaveLength(2);
		expect(otherCandidates(null)).toEqual([]);
		expect(otherCandidates(undefined)).toEqual([]);
	});

	it("tells why the earliest time works, when the candidates say so", () => {
		expect(earliestTooltip(suggestions)).toBe("Earliest\n• Works");
		expect(earliestTooltip({ ...suggestions, candidates: [] })).toBe(
			"Earliest",
		);
		expect(earliestTooltip({ ...suggestions, earliest: null })).toBe("");
		expect(earliestTooltip(null)).toBe("");
	});

	it("lists why the other times were left out", () => {
		expect(rejectedTooltip(suggestions, en)).toBe(
			`${en.playground.options.rejectedSlots}\n• Mon 07:00: too early`,
		);
		expect(rejectedTooltip({ ...suggestions, rejected: [] }, en)).toBe("");
		expect(rejectedTooltip(undefined, en)).toBe("");
	});

	it("words the earliest pill in the language asked", () => {
		expect(earliestLabel(en, "Sun 13:00")).toContain("Sun 13:00");
		expect(earliestLabel(fr, "dim. 13:00")).toContain("dim. 13:00");
		expect(earliestLabel(fr, "x")).not.toBe(earliestLabel(en, "x"));
	});
});
