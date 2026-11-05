import { describe, expect, it } from "bun:test";
import { compile, scheduleFor, scheduleTimes } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { project, runSheet } from "@gram-lang/scheduler";
import { prepareViews } from "../src/index";

const SRC = `---
title: Tart
---

## Pastry ~{-1d}

Mix @flour{200g} and let it rest ~_{12-24h}.

## Assembly

Combine the pastry with @filling{300g}.
`;
const compiled = compile(getAST(SRC));
const kitchen = {
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
	now: "2026-11-10T09:00:00Z",
};

describe("prepareViews", () => {
	it("takes the defaults for the settings it is not given", () => {
		const input = prepareViews(compiled, { rests: undefined });
		expect(input.settings.miseEnPlace).toBe("perSection");
		expect(input.settings.rests).toBe("shortest");
	});

	it("lays the schedule out for the chosen settings, as scheduleFor does", () => {
		const input = prepareViews(compiled, {
			miseEnPlace: "upfront",
			rests: "longest",
		});
		expect(input.schedule).toBe(scheduleFor(compiled, "upfront", "longest")!);
		expect(input.times).toEqual(scheduleTimes(compiled, "upfront", "longest"));
	});

	it("works each part out once, the first time it is read", () => {
		const input = prepareViews(compiled);
		expect(input.runSheet).toBe(input.runSheet);
		expect(input.times).toBe(input.times);
	});

	it("lays the work plan out in days before the service without a serving time", () => {
		const input = prepareViews(compiled);
		expect(input.plan).toBeNull();
		expect(input.runSheet).toEqual(
			runSheet(scheduleFor(compiled)!, {
				graph: compiled.tasks,
				title: "Tart",
			}),
		);
	});

	it("puts the work plan on the calendar with a serving time", () => {
		const serveAt = "2026-11-15T20:00";
		const input = prepareViews(compiled, {}, { kitchen, serveAt });
		const context = { ...kitchen, serveAt };
		const plan = project(
			[
				{
					graph: compiled.tasks,
					title: "Tart",
					options: {
						miseEnPlace: "perSection",
						rests: "shortest",
					},
				},
			],
			context,
		);
		expect(input.plan).toEqual(plan);
		expect(input.runSheet).toEqual(
			runSheet(plan, { graph: compiled.tasks, context }),
		);
		// The recipe's own times stay those of the schedule, at any serving time.
		expect(input.times).toEqual(scheduleTimes(compiled));
	});

	it("needs a kitchen for a serving time", () => {
		expect(() =>
			prepareViews(compiled, {}, { serveAt: "2026-11-15T20:00" }),
		).toThrow(RangeError);
	});

	it("searches serving times from the kitchen, with or without a serving time", () => {
		const input = prepareViews(compiled, {}, { kitchen });
		expect(input.earliestServe()?.found?.serveAt).toBeDefined();
		const search = input.findServeTimes({
			from: "2026-11-11",
			to: "2026-11-14",
		});
		expect(search?.candidates.length).toBeGreaterThan(0);
	});

	it("has no plan, work plan or search without what they need", () => {
		const bare = compile(getAST("## A\n\nNothing to plan.\n"));
		const input = prepareViews({
			...bare,
			tasks: undefined,
			schedule: undefined,
		});
		expect(input.schedule).toBeNull();
		expect(input.runSheet).toBeNull();
		expect(input.projection).toBeNull();
		expect(input.earliestServe()).toBeNull();
		expect(
			prepareViews(compiled).findServeTimes({
				from: "2026-11-11",
				to: "2026-11-12",
			}),
		).toBeNull();
	});
});
