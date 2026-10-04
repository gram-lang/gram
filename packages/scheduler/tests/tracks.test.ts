import { describe, it, expect } from "bun:test";
import { serializeTracks } from "../src/tracks";
import type {
	SchedulingDiagnostic,
	SchedulingSection,
	StepSchedule,
} from "../src/types";

function makeSchedule(overrides: Partial<StepSchedule> = {}): StepSchedule {
	return {
		sectionIndex: 0,
		stepIndex: 0,
		isComment: false,
		localActiveTime: 0,
		productionTime: 0,
		produced: [],
		consumed: [],
		passiveTasks: [],
		ls: 0,
		lf: 0,
		...overrides,
	};
}

function makeSection(
	overrides: Partial<SchedulingSection> = {},
): SchedulingSection {
	return {
		title: null,
		...overrides,
	};
}

describe("serializeTracks", () => {
	it("computes actualStart/actualEnd from ls + localOffset for a single passive task", () => {
		const sched = makeSchedule({
			ls: 10,
			passiveTasks: [
				{ name: "oven", duration: 30, localOffset: 0, isNamed: false },
			],
		});

		const [entry] = serializeTracks([sched], [makeSection()], []);

		expect(entry?.theoreticalStart).toBe(10);
		expect(entry?.actualStart).toBe(10);
		expect(entry?.actualEnd).toBe(40);
	});

	it("delays the second of two overlapping tasks sharing a named track, and warns TRACK_CONTENTION", () => {
		const diagnostics: SchedulingDiagnostic[] = [];
		const first = makeSchedule({
			ls: 0,
			passiveTasks: [
				{ name: "oven", duration: 20, localOffset: 0, isNamed: true },
			],
		});
		const second = makeSchedule({
			ls: 5, // theoretical start (5) falls inside the first task's 0-20 window
			passiveTasks: [
				{ name: "oven", duration: 10, localOffset: 0, isNamed: true },
			],
		});

		const entries = serializeTracks(
			[first, second],
			[makeSection(), makeSection()],
			diagnostics,
		);
		const [a, b] = entries;

		expect(a?.actualStart).toBe(0);
		expect(a?.actualEnd).toBe(20);
		// b's theoretical start (5) collides with the track being busy until
		// 20, so it's pushed to start right when the track frees up.
		expect(b?.actualStart).toBe(20);
		expect(b?.actualEnd).toBe(30);
		expect(diagnostics.some((w) => w.code === "TRACK_CONTENTION")).toBe(true);
	});

	it("does not apply track-contention delay to unnamed passive tasks, even if they overlap", () => {
		const first = makeSchedule({
			ls: 0,
			passiveTasks: [
				{ name: "Timer", duration: 20, localOffset: 0, isNamed: false },
			],
		});
		const second = makeSchedule({
			ls: 5,
			passiveTasks: [
				{ name: "Timer", duration: 10, localOffset: 0, isNamed: false },
			],
		});

		const [a, b] = serializeTracks(
			[first, second],
			[makeSection(), makeSection()],
			[],
			[],
		);

		// Unnamed tasks never share a track cursor — both keep their
		// theoretical start regardless of overlap.
		expect(a?.actualStart).toBe(0);
		expect(b?.actualStart).toBe(5);
	});

	it("ignores comment schedules entirely", () => {
		const comment = makeSchedule({
			isComment: true,
			passiveTasks: [
				{ name: "oven", duration: 30, localOffset: 0, isNamed: true },
			],
		});

		const entries = serializeTracks([comment], [makeSection()], []);
		expect(entries).toHaveLength(0);
	});
});
