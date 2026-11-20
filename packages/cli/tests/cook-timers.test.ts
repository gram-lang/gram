import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { prepareRecipeData } from "../src/ui/cook/prepare";
import { getTimerDisplay } from "../src/ui/cook/StepView";

import { finishedTimers, markDone } from "../src/ui/cook/timers";
import type { ActiveTimer } from "../src/ui/cook/types";

const NB = " ";
const timersOf = (step: string) =>
	prepareRecipeData(compile(getAST(`## A\n\n${step}\n`))).steps[0]?.timers ??
	[];

// `gram cook` runs a timer for the minutes the schedule counts, whatever the
// writing, and shows it the way the views do.
describe("gram cook timers", () => {
	it("runs for the minutes the schedule counts", () => {
		expect(timersOf("Bake ~a{1h30}.")[0]?.durationMs).toBe(90 * 60_000);
		expect(timersOf("Bake ~a{5'30\"}.")[0]?.durationMs).toBe(330_000);
		expect(timersOf("Bake ~a{1:30 h}.")[0]?.durationMs).toBe(90 * 60_000);
		expect(timersOf("Rise ~a{1-2 h}.")[0]?.durationMs).toBe(90 * 60_000);
	});

	it("starts no timer for a refused duration", () => {
		expect(timersOf("Bake ~a{1:30}.")).toEqual([]);
	});

	it("shows a timer as the views do", () => {
		const token = (step: string) =>
			compile(getAST(`## A\n\n${step}\n`)).sections[0]?.steps[0]?.content?.find(
				(c: any) => c.type === "timer",
			);
		expect(getTimerDisplay(token("Bake ~{1h30}."))).toBe(`1${NB}h 30${NB}min`);
		expect(getTimerDisplay(token("Rise ~{1-2 h}."))).toBe(`1–2${NB}h`);
		expect(getTimerDisplay(token("Bake ~{1:30}."))).toBe("1:30");
	});
});

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

// A started timer rings once and shows as done when its time is up.
describe("gram cook timer completion", () => {
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
