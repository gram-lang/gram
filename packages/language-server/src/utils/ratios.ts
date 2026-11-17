import type {
	ProcessedTimer,
	RatioSpec,
	StepToken,
	Usage,
} from "@gram-lang/kitchen";
import { formatTimerDuration, formatUsageQuantity } from "@gram-lang/renderer";
import type { DocumentState } from "../document-state";

/** A ratio of the compiled recipe, where it is written and what it came to. */
export interface CompiledRatio {
	spec: RatioSpec;
	/** The amount or duration it resolved to, as the views write it; `null` when not resolved. */
	resolved: string | null;
}

/** The recipe's own language, for the words and numbers of a hint. */
export function recipeLang(state: DocumentState): string | undefined {
	const lang = state.compilation?.meta?.language;
	return typeof lang === "string" ? lang : undefined;
}

/**
 * Every ratio of the compiled recipe written in this document (an
 * ingredient, a reference, an alternative's option, a proportional time),
 * read once per step token, with what it resolved to. A ratio from another
 * module (`loc.uri`) is left out: its place is in another file.
 */
export function compiledRatios(state: DocumentState): CompiledRatio[] {
	const compilation = state.compilation;
	if (!compilation) return [];
	const lang = recipeLang(state);
	const results: CompiledRatio[] = [];
	const own = (spec: RatioSpec) => spec.loc && !spec.loc.uri;

	const visit = (token: StepToken) => {
		if (typeof token !== "object" || token === null) return;
		if ("type" in token && token.type === "timer") {
			const timer = token as ProcessedTimer;
			if (timer.ratio && own(timer.ratio)) {
				results.push({
					spec: timer.ratio,
					resolved:
						timer.minutes !== undefined
							? formatTimerDuration(timer, lang)
							: null,
				});
			}
			return;
		}
		if (!("id" in token)) return;
		const usage = token as Usage;
		for (const option of usage.options ?? []) visit(option);
		const formula = usage.formula;
		if (!formula || !("ratio" in formula) || !own(formula.ratio)) return;
		const qty = usage.qty as { type?: string } | undefined;
		results.push({
			spec: formula.ratio,
			resolved:
				qty?.type === "RatioQuantity"
					? null
					: formatUsageQuantity(usage as unknown as Record<string, unknown>, {
							lang,
						}),
		});
	};

	for (const sec of compilation.sections) {
		for (const step of sec.steps) {
			if (step.type === "step") step.content.forEach(visit);
		}
	}
	return results;
}
