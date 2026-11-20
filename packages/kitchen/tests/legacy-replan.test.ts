import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { planLegacy } from "../src/legacy-timings";
import { recipeTimings } from "../src/step-timing";
import { stepTasksOf } from "../src/task-graph";
import { cleanObject } from "../src/utils";

// A recalculation of the schedule (scaling, analysis) reads the steps' time
// again from their tokens and runs the legacy pass again: it must land on
// what `compile` wrote, never add its passive tasks to the previous ones.
const source = `## Dough ->&dough

Mix @flour{500 g} and @water{350 g} ~{5 min}.

Let rise ~_rise{1 h}.

// Meanwhile

## Bake

Shape the &dough, then bake ~_oven{35-40 min}.
`;

describe("replanning a compiled recipe", () => {
	it("gives the same deprecated fields and metrics, twice in a row", () => {
		const result = compile(getAST(source));
		const steps = structuredClone(result.sections.map((s) => s.steps));
		const { idleTime, activeTime, activeBreakdown, totalBreakdown } =
			result.metrics;

		for (let i = 0; i < 2; i++) {
			const { schedules } = recipeTimings(result.sections);
			const { metrics, diagnostics } = planLegacy(result.sections, schedules);
			expect(diagnostics).toEqual([]);
			expect(metrics).toEqual({
				idleTime,
				activeTime,
				activeBreakdown,
				totalBreakdown,
			});
			// `compile` hands its result to `cleanObject`, which drops an empty
			// `backgroundTasks`: a recalculation goes through it too.
			expect(cleanObject(result.sections.map((s) => s.steps))).toEqual(steps);
		}
	});

	it("rebuilds the step and timer tasks of the graph", () => {
		const result = compile(getAST(source));
		const { facts } = recipeTimings(result.sections);
		const rebuilt = stepTasksOf(result.sections, facts).flat();
		expect(rebuilt).toEqual(
			result.tasks.tasks.filter((t) => t.kind !== "prep") as typeof rebuilt,
		);
	});
});
