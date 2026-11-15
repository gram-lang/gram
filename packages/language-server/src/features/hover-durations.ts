import { type Hover, MarkupKind } from "vscode-languageserver";
import {
	fillTemplate,
	getDictionary,
	parseDuration,
	resolveTimeUnit,
	TIME_TO_MINUTES,
} from "@gram-lang/i18n";
import { readAnchor } from "@gram-lang/kitchen";
import { isSection, type RetroPlanningAST } from "@gram-lang/parser";
import { formatDuration, formatTimerDuration } from "@gram-lang/renderer";
import type { DocumentState } from "../document-state";
import { collectTimers } from "../utils/ast-walker";

/** The recipe's language, as the views read it. */
function recipeLang(state: DocumentState): string | undefined {
	const meta = state.compilation?.meta?.language;
	return typeof meta === "string" ? meta : undefined;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * An anchor as it is planned, to the minute. `formatDuration` rounds to the
 * hour from a day up, which would show `~{-1d 2h 30min}` as `1 d 3 h`; an
 * anchor in days keeps its days (it opens a working day) and writes the rest
 * in full: `1 d 2 h 30 min`.
 */
function anchorDuration(
	minutes: number,
	inDays: boolean,
	lang: string | undefined,
): string {
	const total = Math.round(minutes);
	const days = Math.floor(total / MINUTES_PER_DAY);
	const rest = total - days * MINUTES_PER_DAY;
	if (!inDays || days === 0 || rest % 60 === 0)
		return formatDuration(total, lang, { days: inDays });
	return `${formatDuration(days * MINUTES_PER_DAY, lang)} ${formatDuration(rest, lang, { days: false })}`;
}

function markdown(value: string): Hover {
	return { contents: { kind: MarkupKind.Markdown, value } };
}

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
	const written = state.text.slice(timer.loc.start, timer.loc.end);
	return markdown(
		`**\`${written}\`** → ${formatTimerDuration(item, recipeLang(state))}`,
	);
}

/**
 * Hover on a section anchor (`## Brioche ~{-1j 12h}`, or on a `@use`): how
 * long before it is used the section is ready, read as the compiler plans it
 * (`readAnchor`), and what its unit means: only an anchor in days opens a
 * working day. An anchor Gram refuses gets no hover, like a timer.
 */
export function provideAnchorHover(
	state: DocumentState,
	offset: number,
): Hover | null {
	if (!state.ast) return null;
	const anchors: RetroPlanningAST[] = [
		...state.ast.children.flatMap((c) =>
			isSection(c) && c.retroPlanning ? [c.retroPlanning] : [],
		),
		...(state.ast.imports ?? []).flatMap((d) =>
			d.retroPlanning ? [d.retroPlanning] : [],
		),
	];
	const anchor = anchors.find(
		(a) => a.loc && a.loc.start <= offset && offset < a.loc.end,
	);
	if (!anchor?.loc) return null;

	const reading = readAnchor(anchor.raw);
	if (!reading.ok) return null;

	const lang = recipeLang(state);
	const t = getDictionary(lang).languageServer;
	const inDays = reading.unit === "d";
	const minutes =
		reading.value * (TIME_TO_MINUTES[resolveTimeUnit(reading.unit)] ?? 1);
	const duration = anchorDuration(minutes, inDays, lang);
	const written = state.text.slice(anchor.loc.start, anchor.loc.end);
	return markdown(
		[
			`**\`${written}\`** → ${fillTemplate(t.anchorReady, { duration })}`,
			inDays ? t.anchorInDays : t.anchorInHours,
		].join("\n\n"),
	);
}
