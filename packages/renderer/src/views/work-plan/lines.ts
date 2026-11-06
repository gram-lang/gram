import type {
	RunSheetKitGroup,
	RunSheetKitLine,
	RunSheetProgramLine,
} from "./model";

/** A section's name in a programme, marked when it goes on from an earlier visit. */
export const sectionHeading =
	(t: { workPlanContinued: string }) => (l: RunSheetProgramLine) =>
		l.continued ? `${l.section} (${t.workPlanContinued})` : l.section;

/**
 * The lines of a kit, group by group: a title above the lines of a group that
 * has one. `gap` goes between a title and what follows it, when it is needed.
 */
export function kitLines(
	kit: RunSheetKitGroup[],
	format: {
		title: (section: string) => string;
		item: (line: RunSheetKitLine) => string;
		gap?: string;
	},
): string[] {
	const out: string[] = [];
	kit.forEach((group, i) => {
		if (group.section) {
			if (i > 0 && format.gap !== undefined) out.push(format.gap);
			out.push(format.title(group.section));
			if (format.gap !== undefined) out.push(format.gap);
		} else if (i > 0 && format.gap !== undefined) {
			out.push(format.gap);
		}
		for (const l of group.items) out.push(format.item(l));
	});
	return out;
}
