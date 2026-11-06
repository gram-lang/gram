import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { earliestServe, findServeTimes } from "@gram-lang/scheduler";
import {
	describeEarliestServe,
	describeServeTimes,
	prepareViews,
	suggestServeTimes,
} from "../src/index";

const compiled = compile(
	getAST(`---
title: Batter
---

## Batter ->&batter ~{-1d}

[Mix] Mix @flour{200g} and @milk{300ml}.

[Rest] Rest ~_{20-40h}.

## Bake

[Bake] Bake the &batter{500g} for ~{20min}.
`),
);
const input = { graph: compiled.tasks };
const context = {
	serveAt: "2026-10-12T20:00",
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
	now: "2026-10-10T10:00",
};

describe("describeServeTimes", () => {
	const search = findServeTimes(input, context, {
		from: "2026-10-10",
		to: "2026-10-12",
	});
	const lines = describeServeTimes(search, compiled, {
		timeZone: "Europe/Paris",
		from: "2026-10-10",
		to: "2026-10-12",
	});

	it("says what works, with when to start and what was adjusted", () => {
		const ok = lines.find((l) => l.includes("Monday") || l.includes("Sunday"));
		expect(
			lines.some((l) => /— start .* · \d visits? to the kitchen · /.test(l)),
		).toBe(true);
		expect(ok).toBeDefined();
	});

	it("says why a time does not work, in the words of the plan", () => {
		expect(
			lines.some((l) => l.includes("not possible. You would have to start")),
		).toBe(true);
	});

	it("speaks French", () => {
		const fr = describeServeTimes(search, compiled, {
			timeZone: "Europe/Paris",
			from: "2026-10-10",
			to: "2026-10-12",
			lang: "fr",
		});
		expect(
			fr.some((l) => l.includes("impossible. Il faudrait commencer")),
		).toBe(true);
	});

	it("says when nothing was tried or nothing works", () => {
		expect(
			describeServeTimes({ candidates: [], rejected: [] }, compiled, {
				timeZone: "UTC",
				from: "a",
				to: "b",
			}),
		).toEqual(["No serving time works between a and b."]);
	});
});

describe("describeEarliestServe", () => {
	it("gives the first time it can be ready", () => {
		const result = earliestServe(input, context);
		expect(describeEarliestServe(result)).toMatch(
			/^Ready as early as \w+, October \d+ \d\d:\d\d if you start now\.$/,
		);
	});

	it("says where it stopped looking", () => {
		const result = earliestServe(input, {
			...context,
			availability: { daily: [] },
		});
		expect(describeEarliestServe(result)).toContain(
			"Nothing works in the next 14 days",
		);
	});
});

describe("suggestServeTimes", () => {
	const kitchen = {
		timeZone: "Europe/Paris",
		availability: { daily: [{ start: "08:00", end: "22:00" }] },
		now: "2026-10-10T10:00",
	};

	it("proposes the times that work over the next days, in words, and the earliest", () => {
		const s = suggestServeTimes(prepareViews(compiled, {}, { kitchen }), {
			days: 3,
		});
		expect(s).not.toBeNull();
		expect(s!.candidates.length).toBeGreaterThan(0);
		for (const c of s!.candidates) {
			expect(c.serveAt >= "2026-10-10T00:00").toBe(true);
			expect(c.serveAt <= "2026-10-13T23:59").toBe(true);
			expect(c.label).toMatch(/\d{2}:\d{2}/);
			expect(c.title).not.toBe("");
		}
		// The batter rests 20 hours at least: nothing works on the first day.
		expect(s!.rejected.length).toBeGreaterThan(0);
		expect(s!.earliest?.serveAt).toBeString();
		expect(s!.earliest?.text).not.toBe("");
	});

	it("speaks the language asked for", () => {
		const s = suggestServeTimes(prepareViews(compiled, {}, { kitchen }), {
			lang: "fr",
			days: 3,
		});
		expect(s!.earliest?.text).not.toBe(
			suggestServeTimes(prepareViews(compiled, {}, { kitchen }), { days: 3 })!
				.earliest?.text,
		);
	});

	it("is null without a kitchen or without anything to schedule", () => {
		expect(suggestServeTimes(prepareViews(compiled))).toBeNull();
		const note = compile(getAST("---\ntitle: Note\n---\n"));
		expect(suggestServeTimes(prepareViews(note, {}, { kitchen }))).toBeNull();
	});
});
