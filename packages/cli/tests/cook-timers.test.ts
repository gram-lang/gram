import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { prepareRecipeData } from "../src/ui/cook/prepare";
import { getTimerDisplay } from "../src/ui/cook/StepView";

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
