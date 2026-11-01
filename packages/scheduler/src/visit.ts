import type { RunSheetVisit } from "./runsheet";

/**
 * The sections to name a visit after: the ones it cooks, or, for a visit of
 * mise en place only, the ones it prepares.
 */
export function visitSections(
	visit: Pick<RunSheetVisit, "sections" | "worked">,
): number[] {
	return visit.worked.length > 0 ? visit.worked : visit.sections;
}
