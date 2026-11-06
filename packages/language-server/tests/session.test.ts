import { describe, expect, it } from "bun:test";
import {
	compileSessionChanged,
	compileSessionOf,
	parseSession,
} from "../src/session";

describe("parseSession", () => {
	it("reads every part of a well-formed session", () => {
		expect(
			parseSession({
				uri: "file:///a.gram",
				serveAt: "2026-10-11 9:30",
				scale: { type: "factor", value: 2 },
				stock: ["file:///b.gram", "file:///a-base.gram", "file:///b.gram"],
				bakersReference: "flour",
			}),
		).toEqual({
			serveAt: "2026-10-11T09:30",
			scale: { type: "factor", value: 2 },
			stock: ["file:///a-base.gram", "file:///b.gram"],
			bakersReference: "flour",
		});
	});

	it("reads a target scale, with or without a unit", () => {
		expect(
			parseSession({
				scale: { type: "target", id: "flour", qty: 500, unit: "g" },
			}),
		).toEqual({ scale: { type: "target", id: "flour", qty: 500, unit: "g" } });
		expect(
			parseSession({ scale: { type: "target", id: "egg", qty: 3 } }),
		).toEqual({ scale: { type: "target", id: "egg", qty: 3, unit: null } });
	});

	it("leaves out what it cannot read, and never throws", () => {
		expect(parseSession(null)).toEqual({});
		expect(parseSession("tomorrow")).toEqual({});
		expect(
			parseSession({
				serveAt: "tomorrow at noon",
				scale: { type: "factor", value: -1 },
				stock: "file:///b.gram",
				bakersReference: 42,
			}),
		).toEqual({});
		expect(parseSession({ serveAt: "2026-10-11T25:00" })).toEqual({});
		expect(parseSession({ scale: { type: "target", id: "", qty: 3 } })).toEqual(
			{},
		);
	});

	it("drops a scale of ×1 and an empty stock: there is nothing to compile again", () => {
		expect(
			parseSession({ scale: { type: "factor", value: 1 }, stock: [] }),
		).toEqual({});
	});
});

describe("the compile part of a session", () => {
	it("is nothing for a serving time alone", () => {
		expect(compileSessionOf({ serveAt: "2026-10-11T13:00" })).toBeUndefined();
	});

	it("changes with the scale, the stock or the reference, not the serving time", () => {
		const base = { scale: { type: "factor", value: 2 } } as const;
		expect(
			compileSessionChanged(base, { ...base, serveAt: "2026-10-11T13:00" }),
		).toBe(false);
		expect(
			compileSessionChanged(base, { scale: { type: "factor", value: 3 } }),
		).toBe(true);
		expect(
			compileSessionChanged(base, { ...base, stock: ["file:///b.gram"] }),
		).toBe(true);
		expect(compileSessionChanged(base, {})).toBe(true);
	});
});
