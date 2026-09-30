import {
	type CompilationResult,
	quantityToMinutes,
	scheduleFor,
} from "@gram-lang/kitchen";

/**
 * Duration, in minutes, of every background timer (`~_name{}`) that runs
 * during one step, in the order they start. `step` is the step's index in
 * `sections[section].steps`, comments included — the same index the schedule
 * blocks use. A timer's length doesn't depend on the mise en place mode.
 */
export function passiveTimers(
	compiled: Pick<CompilationResult, "schedules" | "sections">,
	section: number,
	step: number,
): Array<{ name?: string; duration: number }> {
	const blocks = (scheduleFor(compiled)?.blocks ?? []).filter(
		(b) => b.kind === "passive" && b.section === section && b.step === step,
	);
	const timers = blocks.map((b) => ({
		name: b.kind === "passive" ? b.track : undefined,
		duration: b.end - b.start,
	}));

	// The blocks come sorted by start then end, not in the order the timers are
	// written in the step. Put them back in text order by pairing each passive
	// timer token with the first block of the same name (or, for an anonymous
	// timer, of the same length).
	const source = compiled.sections[section]?.steps[step];
	const tokens = source?.type === "step" ? source.content : undefined;
	if (!Array.isArray(tokens)) return timers;
	const remaining = [...timers];
	const ordered: typeof timers = [];
	for (const token of tokens) {
		if (typeof token === "string" || !("isPassive" in token)) continue;
		if (token.type !== "timer" || !token.isPassive) continue;
		const minutes = quantityToMinutes(
			token.quantity as Parameters<typeof quantityToMinutes>[0],
		);
		const at = remaining.findIndex((t) =>
			token.name ? t.name === token.name : !t.name && t.duration === minutes,
		);
		if (at !== -1) ordered.push(...remaining.splice(at, 1));
	}
	return [...ordered, ...remaining];
}
