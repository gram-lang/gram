import type { StepSchedule } from "@gram-lang/scheduler";
import { type StepFact, type TimerFact, taskIds } from "./task-graph";
import type { ProcessedSection, StepToken } from "./types";
import { quantityToMinutes, quantityToMinutesRange } from "./utils";

/** What one step weighs in time: for the task graph, and for the legacy pass. */
export interface StepTiming {
	fact: StepFact;
	schedule: StepSchedule;
}

/**
 * The timing of one step, read from its tokens: its active time, its timers,
 * and the intermediates it makes and uses. A timer with no duration (refused,
 * or a ratio still waiting for its target) does not count; a step with no
 * duration at all takes 2 minutes of work.
 *
 * Pure: `compile` reads it once every step is known, and a recalculation
 * (scaling, analysis) reads it again from the same tokens.
 */
export function stepTiming(
	content: StepToken[],
	section: number,
	step: number,
): StepTiming {
	let localActiveTime = 0;
	// The same step, as the task graph sees it: a timer written as a range is
	// planned on its longest figure when active, its shortest when passive
	// (`localActiveTime` and the timers' durations keep the average, for the
	// deprecated fields).
	let nominalActive = 0;
	const timerFacts: TimerFact[] = [];
	const passiveTasks: StepSchedule["passiveTasks"] = [];
	const produced: string[] = [];
	const consumed: string[] = [];

	for (const token of content) {
		if (typeof token === "string" || !("type" in token)) continue;
		if (token.type === "reference" && token.name) {
			consumed.push(token.name);
		} else if (token.type === "declaration" && token.name) {
			produced.push(token.name);
		} else if (token.type === "timer" && !("id" in token) && token.quantity) {
			const time = { value: token.quantity, unit: token.unit };
			const duration = quantityToMinutes(time);
			const { min, max } = quantityToMinutesRange(time);
			if (token.isPassive) {
				timerFacts.push({
					...(token.name && { track: token.name }),
					offset: nominalActive,
					duration: min === max ? { nominal: min } : { nominal: min, min, max },
				});
				passiveTasks.push({
					taskId: taskIds.timer(section, step, passiveTasks.length),
					name: token.name || "Timer",
					duration,
					localOffset: localActiveTime,
					isNamed: !!token.name,
					// Only set for genuinely named tracks — left undefined for
					// anonymous passive timers so the renderer's own localized
					// "Timer" fallback applies instead of a hardcoded English
					// string baked into the JSON.
					sourceName: token.name || undefined,
				});
			} else {
				localActiveTime += duration;
				nominalActive += max;
			}
		}
	}

	if (localActiveTime === 0 && passiveTasks.length === 0) {
		localActiveTime = 2;
		nominalActive = 2;
	}

	let productionTime = localActiveTime;
	for (const task of passiveTasks) {
		productionTime = Math.max(productionTime, task.localOffset + task.duration);
	}

	return {
		fact: {
			section,
			step,
			active: nominalActive,
			timers: timerFacts,
			produced: [...produced],
			consumed: [...consumed],
		},
		schedule: {
			taskId: taskIds.step(section, step),
			sectionIndex: section,
			stepIndex: step,
			isComment: false,
			localActiveTime,
			productionTime,
			produced,
			consumed,
			passiveTasks,
			ls: 0,
			lf: 0,
		},
	};
}

/** A comment's place in the legacy pass: it takes no time. */
function commentSchedule(section: number, step: number): StepSchedule {
	return {
		taskId: taskIds.step(section, step),
		sectionIndex: section,
		stepIndex: step,
		isComment: true,
		localActiveTime: 0,
		productionTime: 0,
		produced: [],
		consumed: [],
		passiveTasks: [],
		ls: 0,
		lf: 0,
	};
}

/**
 * The timing of every step of a recipe, section by section: the step facts
 * of the task graph (steps only), and the schedules of the legacy pass
 * (comments included).
 */
export function recipeTimings(sections: ProcessedSection[]): {
	facts: StepFact[];
	schedules: StepSchedule[];
} {
	const facts: StepFact[] = [];
	const schedules: StepSchedule[] = [];
	sections.forEach((sec, sectionIndex) => {
		sec.steps.forEach((item, stepIndex) => {
			if (item.type === "step") {
				const { fact, schedule } = stepTiming(
					item.content,
					sectionIndex,
					stepIndex,
				);
				facts.push(fact);
				schedules.push(schedule);
			} else if (item.type === "comment") {
				schedules.push(commentSchedule(sectionIndex, stepIndex));
			}
		});
	});
	return { facts, schedules };
}
