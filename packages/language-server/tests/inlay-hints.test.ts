import { scheduleFor } from "@gram-lang/kitchen";
import { describe, expect, it } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideInlayHints } from "../src/features/inlay-hints";

// The three timelines of a compiled recipe, laid out from its task graph.
const schedulesOf = (c: Parameters<typeof scheduleFor>[0]) => ({
	perSection: scheduleFor(c, "perSection")!,
	upfront: scheduleFor(c, "upfront")!,
	perSession: scheduleFor(c, "perSession")!,
});

const SOURCE = `---
title: Tart
---

## Pastry ~{-2d}

Mix @flour{200g}(sifted).

## Assembly

Combine the pastry with @filling{300g}.
`;

const label = (hints: ReturnType<typeof provideInlayHints>) =>
	hints.map((h) => h.label).join("");

describe("provideInlayHints follows the chosen schedule", () => {
	const state = parseDocument(SOURCE);

	it("reads the total from the schedule, not from the deprecated metric", () => {
		const { perSection, upfront } = schedulesOf(state.compilation!);
		expect(perSection.totalTime).not.toBe(upfront.totalTime);

		const fmt = (minutes: number) => {
			const total = Math.round(minutes);
			const h = Math.floor(total / 60);
			const m = total % 60;
			return h > 0 ? (m > 0 ? `${h}h${m}` : `${h}h`) : `${m}m`;
		};
		expect(label(provideInlayHints(state, "perSection"))).toContain(
			fmt(perSection.totalTime),
		);
		expect(label(provideInlayHints(state, "upfront"))).toContain(
			fmt(upfront.totalTime),
		);
	});

	it("defaults to the per-section schedule", () => {
		expect(label(provideInlayHints(state))).toBe(
			label(provideInlayHints(state, "perSection")),
		);
	});

	it("still shows nothing for a recipe that failed to compile", () => {
		expect(
			provideInlayHints(parseDocument("## Broken\n\nAdd @salt{1 g/l}.\n")),
		).toEqual([]);
	});
});
