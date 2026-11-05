import { describe, expect, it } from "bun:test";
import type { RunSheetEvent, RunSheetModel } from "@gram-lang/renderer";
import { buildICS } from "../src/services/ics";

const event = (over: Partial<RunSheetEvent> = {}): RunSheetEvent => ({
	start: "2026-10-10T19:40:00Z",
	end: "2026-10-10T20:00:00Z",
	title: "Bread · Dough",
	description:
		"To take out :\n- flour 500 g, water\n\nTo do :\n- Dough (steps 1 to 2)",
	...over,
});

const model = (...events: RunSheetEvent[]): RunSheetModel => ({
	title: "Work plan — Bread",
	subtitle: "For Sunday, October 11 at 13:00",
	summary: "2 days",
	problems: [],
	schedule: [],
	days: [],
	events,
});

const STAMP = { stamp: "2026-10-01T09:00:00Z" };

describe("buildICS", () => {
	const ics = buildICS(model(event()), STAMP);

	it("is a calendar with CRLF line ends, named after the plan", () => {
		expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
		expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
		expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
		expect(ics).toContain("X-WR-CALNAME:Work plan — Bread");
	});

	it("writes an event per visit in UTC, stamped as asked, with a stable id", () => {
		expect(ics).toContain("DTSTART:20261010T194000Z");
		expect(ics).toContain("DTEND:20261010T200000Z");
		expect(ics).toContain("DTSTAMP:20261001T090000Z");
		expect(ics).toContain("SUMMARY:Bread · Dough");
		expect(ics).toContain("UID:20261010T194000Z-1@gram-lang.org");
		expect(buildICS(model(event()), STAMP)).toBe(ics);
	});

	it("puts the lists in the description, escaped", () => {
		expect(ics.replace(/\r\n /g, "")).toContain(
			"DESCRIPTION:To take out :\\n- flour 500 g\\, water\\n\\nTo do :\\n- Dough (steps 1 to 2)",
		);
	});

	it("rings an alarm before each visit", () => {
		expect(ics).toContain("BEGIN:VALARM");
		expect(ics).toContain("TRIGGER:-PT10M");
		expect(buildICS(model(event()), { ...STAMP, alarmMinutes: 30 })).toContain(
			"TRIGGER:-PT30M",
		);
	});

	it("keeps ids unique across the visits", () => {
		const two = buildICS(
			model(
				event(),
				event({ start: "2026-10-10T19:40:00Z", end: "2026-10-10T21:10:00Z" }),
			),
			STAMP,
		);
		const uids = [...two.matchAll(/^UID:(.*)$/gm)].map((m) => m[1]);
		expect(new Set(uids).size).toBe(2);
	});

	it("is empty of events for a plan with no visit", () => {
		expect(buildICS(model(), STAMP)).not.toContain("BEGIN:VEVENT");
	});

	it("folds long lines at 75 octets without cutting a character", () => {
		const long = buildICS(
			model(event({ title: `${"é".repeat(60)} ⏲️ end` })),
			STAMP,
		);
		for (const physical of long.split("\r\n")) {
			expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
		}
		const unfolded = long.replace(/\r\n /g, "");
		expect(unfolded).toContain(`SUMMARY:${"é".repeat(60)} ⏲️ end`);
	});
});
