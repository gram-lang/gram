import type { SectionAST } from "@gram-lang/parser";
import type { ProcessedSection } from "../types";
import { WarningCode, pushWarning, type Warning } from "../warnings";
import type { StepSchedule } from "./types";

/**
 * Backward ("as late as possible") scheduling pass. Walks sections from last
 * to first and, within each section, steps from last to first, computing
 * `ls`/`lf` (latest start/finish, relative to an arbitrary T-zero — rebase.ts
 * shifts everything positive afterward) for every non-comment schedule.
 *
 * Mutates `schedules` in place (sets `.ls`/`.lf`) and may push
 * `TIME_PARADOX` warnings. `sections`/`sectionASTs` are read-only here — only
 * used for `.title`/`.retro_planning`/`.intermediate_preparation` and `.loc`
 * on warnings, respectively.
 */
export function scheduleALAP(
	schedules: StepSchedule[],
	sections: ProcessedSection[],
	sectionASTs: SectionAST[],
	warnings: Warning[],
): void {
	const latestReady = new Map<string, number>();

	const stepsBySection: StepSchedule[][] = Array.from(
		{ length: sections.length },
		() => [],
	);
	for (const sched of schedules) {
		if (!sched.isComment) stepsBySection[sched.sectionIndex]!.push(sched);
	}

	for (let sIdx = sections.length - 1; sIdx >= 0; sIdx--) {
		const section = sections[sIdx]!;
		const sectionSteps = stepsBySection[sIdx]!;

		if (sectionSteps.length === 0) continue;

		// 1. Default Chaining: End of this section is the start of the next
		// *non-empty* section. Reading only `stepsBySection[sIdx + 1]` left
		// `chainedLf` at its 0 default whenever
		// the immediately-following section had no steps (empty, or
		// comment-only — comments are filtered out of stepsBySection above),
		// which chained the current section to T-zero instead of to whatever
		// comes after the gap, overlapping it with an still-active timer.
		let chainedLf = 0;
		for (let j = sIdx + 1; j < sections.length; j++) {
			const laterSectionSteps = stepsBySection[j]!;
			if (laterSectionSteps.length > 0) {
				chainedLf = laterSectionSteps[0]!.ls;
				break;
			}
		}

		// 2. Human Anchor: Explicit retro_planning
		let retroPlanningLf = Infinity;
		if (
			section.retro_planning &&
			section.retro_planning.minutes !== undefined
		) {
			retroPlanningLf = -Math.abs(section.retro_planning.minutes);
		}

		// 3. Mathematical Dependency (Section-level intermediate)
		let dependencyLf = Infinity;
		if (section.intermediate_preparation) {
			const req = latestReady.get(section.intermediate_preparation);
			if (req !== undefined) {
				dependencyLf = req;
				// The section's product isn't necessarily ready when its textually
				// last step ends — an earlier step's passive tail (e.g. an
				// overnight ferment followed by a quick finishing step) can easily
				// outlast everything after it. Inject the requirement into every
				// step in the section rather than just the last one: each step
				// independently computes how far back IT would need to move to
				// have its own active+passive work finish by `req`, and the
				// `min()`/chaining below naturally lets whichever step is actually
				// binding win, exactly like today's `Math.max` over all
				// background-task ends used to before this refactor.
				for (const step of sectionSteps) {
					if (!step.produced.includes(section.intermediate_preparation)) {
						step.produced.push(section.intermediate_preparation);
					}
				}
			}
		}

		// TIME PARADOX verification
		if (retroPlanningLf !== Infinity && dependencyLf !== Infinity) {
			if (dependencyLf < retroPlanningLf) {
				pushWarning(warnings, WarningCode.TIME_PARADOX, {
					cause: `Section '${section.title || "unnamed"}' (~{${section.retro_planning!.value}${section.retro_planning!.unit}})`,
					conflict: `downstream dependency at T${dependencyLf}m`,
					loc: sectionASTs[sIdx]?.loc,
				});
			}
		}

		let currentLf = Math.min(chainedLf, retroPlanningLf, dependencyLf);

		// Traverse steps backwards within the section
		for (let i = sectionSteps.length - 1; i >= 0; i--) {
			const sched = sectionSteps[i]!;

			let stepDependencyLf = Infinity;
			for (const p of sched.produced) {
				const req = latestReady.get(p);
				if (req !== undefined) {
					stepDependencyLf = Math.min(
						stepDependencyLf,
						req - sched.productionTime + sched.localActiveTime,
					);
				}
			}

			sched.lf = Math.min(currentLf, stepDependencyLf);
			sched.ls = sched.lf - sched.localActiveTime;

			for (const c of sched.consumed) {
				const current = latestReady.get(c) ?? Infinity;
				latestReady.set(c, Math.min(current, sched.ls));
			}

			currentLf = sched.ls;
		}
	}
}
