import { scheduleFor } from "@gram-lang/kitchen";
import { formatDuration } from "@gram-lang/renderer";
import { describe, expect, it } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideInlayHints } from "../src/features/inlay-hints";

// The three timelines of a compiled recipe, laid out from its task graph.
const schedulesOf = (c: Parameters<typeof scheduleFor>[0]) => ({
	perSection: scheduleFor(c, "perSection")!,
	upfront: scheduleFor(c, "upfront")!,
	perDay: scheduleFor(c, "perDay")!,
});

const SOURCE = `---
title: Tart
---

## Pastry ~{-2h}

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

		// The hint says the total as the views do.
		expect(label(provideInlayHints(state, "perSection"))).toContain(
			`Total time: ${formatDuration(perSection.totalTime)}`,
		);
		expect(label(provideInlayHints(state, "upfront"))).toContain(
			`Total time: ${formatDuration(upfront.totalTime)}`,
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

describe("provideInlayHints follows the choice of rests", () => {
	const state = parseDocument(
		"---\ntitle: Bread\n---\n\n## Dough ->&dough\n\nKnead @flour{500g} ~{20min}, then rest ~_{8-16h}.\n\n## Bake\n\nBake &dough{500g} ~{30min}.\n",
	);

	it("reads the total of the shortest rests by default, and of the longest on request", () => {
		const hint = (rests?: "shortest" | "longest") =>
			label(provideInlayHints(state, undefined, rests));
		expect(hint()).toBe(hint("shortest"));
		expect(hint("longest")).not.toBe(hint("shortest"));
		const hours = (text: string) => Number(/(\d+)h/.exec(text)?.[1]);
		expect(hours(hint("longest")) - hours(hint("shortest"))).toBe(8);
	});
});
