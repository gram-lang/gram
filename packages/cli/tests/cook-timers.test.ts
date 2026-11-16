import { describe, expect, it } from "bun:test";
import { finishedTimers, markDone } from "../src/ui/cook/timers";
import type { ActiveTimer } from "../src/ui/cook/types";

const timer = (
	id: string,
	startedAt: number,
	durationMs: number,
	done = false,
): ActiveTimer => ({
	id,
	name: id,
	durationMs,
	startedAt,
	done,
});

describe("gram cook timers", () => {
	it("finds a running timer once its time is up, not before", () => {
		const timers = [timer("a", 0, 60_000)];
		expect(finishedTimers(timers, 59_999).size).toBe(0);
		expect([...finishedTimers(timers, 60_000)]).toEqual(["a"]);
		expect([...finishedTimers(timers, 90_000)]).toEqual(["a"]);
	});

	it("never returns a timer already done, so it rings only once", () => {
		const timers = [timer("a", 0, 60_000, true)];
		expect(finishedTimers(timers, 120_000).size).toBe(0);
	});

	it("finds every timer that ends within the same check", () => {
		const timers = [
			timer("a", 0, 60_000),
			timer("b", 30_000, 30_000),
			timer("c", 0, 120_000),
		];
		expect([...finishedTimers(timers, 61_000)]).toEqual(["a", "b"]);
	});

	it("marks the finished timers as done and keeps the others running", () => {
		const timers = [timer("a", 0, 60_000), timer("c", 0, 120_000)];
		const next = markDone(timers, new Set(["a"]));
		expect(next.map((t) => t.done)).toEqual([true, false]);
		expect(timers[0]?.done).toBe(false);
	});

	it("returns the same array when nothing changes", () => {
		const timers = [timer("a", 0, 60_000, true)];
		expect(markDone(timers, new Set(["a"]))).toBe(timers);
		expect(markDone(timers, new Set())).toBe(timers);
	});

	it("leaves a restarted timer running when an older run with the same id is done", () => {
		const timers = [timer("a", 0, 60_000, true), timer("a", 70_000, 60_000)];
		expect(finishedTimers(timers, 100_000).size).toBe(0);
		expect([...finishedTimers(timers, 130_000)]).toEqual(["a"]);
	});
});
