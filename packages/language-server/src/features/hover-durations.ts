import { type Hover, MarkupKind } from "vscode-languageserver";
import { parseDuration } from "@gram-lang/i18n";
import { formatTimerDuration } from "@gram-lang/renderer";
import type { DocumentState } from "../document-state";
import { collectTimers } from "../utils/ast-walker";

/**
 * Hover on a `~timer`: the timer as written, then its duration as the views
 * display it (`~{1h30}` → `1 h 30 min`, in the recipe's language), so the
 * author sees how Gram read `1:30 h` or `5'30"`. A duration Gram refuses
 * gets no hover: its diagnostic already says why.
 */
export function provideTimerHover(
	state: DocumentState,
	offset: number,
): Hover | null {
	if (!state.ast) return null;
	const timer = collectTimers(state.ast).find(
		(t) => t.loc && t.loc.start <= offset && offset < t.loc.end,
	);
	if (!timer?.loc) return null;

	const duration = parseDuration(timer.raw);
	if (!duration.ok) return null;

	// The compiled timer's shape: a range keeps its ends in `unit` (minutes).
	const item = {
		raw: timer.raw,
		minutes: duration.minutes,
		unit: "min",
		quantity: duration.range
			? { type: "range", range: duration.range }
			: { type: "single", value: duration.minutes },
	};
	const meta = state.compilation?.meta?.language;
	const lang = typeof meta === "string" ? meta : undefined;
	const written = state.text.slice(timer.loc.start, timer.loc.end);

	return {
		contents: {
			kind: MarkupKind.Markdown,
			value: `**\`${written}\`** → ${formatTimerDuration(item, lang)}`,
		},
	};
}
