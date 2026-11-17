import { type Task, layout } from "@gram-lang/scheduler";
import { planLegacy } from "./legacy-timings";
import { recipeTimings } from "./step-timing";
import { stepTasksOf } from "./task-graph";
import type { CompilationResult, ProcessedSection } from "./types";
import { cleanObject } from "./utils";

/**
 * Lays a compiled recipe out again once a timer's duration has changed (a
 * proportional time resolved again by scaling or by the analyzer), through
 * the same functions as `compile`: the steps' time read again from their
 * tokens, their step and timer tasks rebuilt (a timer that had no duration
 * had no task), the mise en place kept as it is (it does not depend on
 * quantities), the default timeline laid out, then the legacy pass and its
 * deprecated fields (`timings`, `backgroundTasks`, `metrics`).
 *
 * Writes on `result`: the caller passes its own copy. Scheduling problems
 * found again are not warnings: the warnings describe the recipe as written.
 */
export function recomputeSchedule(result: CompilationResult): void {
	const { facts, schedules } = recipeTimings(result.sections);
	const stepsOf = stepTasksOf(result.sections, facts);

	const prepsOf = new Map<number, Task[]>();
	for (const task of result.tasks.tasks) {
		if (task.kind !== "prep") continue;
		const list = prepsOf.get(task.section);
		if (list) list.push(task);
		else prepsOf.set(task.section, [task]);
	}
	const tasks: Task[] = [];
	result.sections.forEach((_, index) => {
		tasks.push(...(prepsOf.get(index) ?? []));
		tasks.push(...(stepsOf[index] ?? []));
	});
	result.tasks = { ...result.tasks, tasks };
	result.schedule = layout(result.tasks).schedule;

	const { metrics } = planLegacy(result.sections, schedules);
	// `compile` hands its sections to `cleanObject`: an empty
	// `backgroundTasks` is left out there, so it is here too.
	result.sections = cleanObject(result.sections) as ProcessedSection[];
	// @remove-in: 2.0.0 [kitchen-metrics-times, kitchen-metrics-active-time, kitchen-metrics-breakdowns]
	result.metrics = {
		...result.metrics,
		totalTime:
			result.metrics.preparationTime + metrics.idleTime + metrics.activeTime,
		totalBreakdown: metrics.totalBreakdown,
		idleTime: metrics.idleTime,
		activeTime: metrics.activeTime,
		activeBreakdown: metrics.activeBreakdown,
	};
}
