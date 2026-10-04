import { describe, expect, it } from "bun:test";
import type { RunSheetModel } from "@gram-lang/renderer";
import { buildICS } from "../src/services/ics";

const line = (over: Partial<RunSheetModel["days"][0]["lines"][0]> = {}) => ({
	task: "s0.0",
	kind: "step" as const,
	start: "2026-10-10T19:40:00Z",
	end: "2026-10-10T20:00:00Z",
	when: "around 21:40",
	title: "Dough — Mix",
	detail: "Mix flour, then knead; rest.",
	length: "20m",
	active: true,
	...over,
});

const model = (...lines: ReturnType<typeof line>[]): RunSheetModel => ({
	title: "Production sheet — Bread",
	servedAt: "Served Sunday, October 11 at 13:00",
	days: [{ heading: "Saturday · D-1", lines }],
	problems: [],
});

const STAMP = { stamp: "2026-10-01T09:00:00Z" };

describe("buildICS", () => {
	const ics = buildICS(model(line()), STAMP);

	it("is a calendar with CRLF line ends", () => {
		expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
		expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
		expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
	});

	it("writes an event in UTC, stamped as asked, with a stable id", () => {
		expect(ics).toContain("DTSTART:20261010T194000Z");
		expect(ics).toContain("DTEND:20261010T200000Z");
		expect(ics).toContain("DTSTAMP:20261001T090000Z");
		expect(ics).toContain("UID:20261010T194000Z-s0.0@gram-lang.org");
		expect(buildICS(model(line()), STAMP)).toBe(ics);
	});

	it("escapes commas, semicolons and newlines in the text", () => {
		expect(ics).toContain("DESCRIPTION:Mix flour\\, then knead; rest.\\n20m");
	});

	it("rings an alarm before a task that needs the hands, and not before a rest", () => {
		expect(ics).toContain("BEGIN:VALARM");
		expect(ics).toContain("TRIGGER:-PT5M");
		const rest = buildICS(
			model(line({ active: false, kind: "passive" })),
			STAMP,
		);
		expect(rest).not.toContain("VALARM");
	});

	it("keeps ids unique when two events share a task", () => {
		const two = buildICS(
			model(
				line(),
				line({ start: "2026-10-10T21:00:00Z", end: "2026-10-10T21:10:00Z" }),
			),
			STAMP,
		);
		const uids = [...two.matchAll(/^UID:(.*)$/gm)].map((m) => m[1]);
		expect(new Set(uids).size).toBe(2);
	});

	it("folds long lines at 75 octets without cutting a character", () => {
		const long = buildICS(
			model(line({ title: `${"é".repeat(60)} ⏲️ end` })),
			STAMP,
		);
		for (const physical of long.split("\r\n")) {
			expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
		}
		const unfolded = long.replace(/\r\n /g, "");
		expect(unfolded).toContain(`SUMMARY:${"é".repeat(60)} ⏲️ end`);
	});
});
