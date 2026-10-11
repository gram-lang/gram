import { describe, expect, it } from "bun:test";
import { MISE_EN_PLACE_MODES, REST_CHOICES } from "../src/mode";
import { project } from "../src/project";
import type { TaskGraph } from "../src/graph";
import graphJson from "./fixtures/canneles-graph.json";

// A two-day recipe: a batter made the day before (`~{-1d}`, a 24-48 h rest),
// baked on the day, with mise en place that depends on an intermediate.
const graph = graphJson as unknown as TaskGraph;
const availability = { daily: [{ start: "08:00", end: "22:00" }] };
const NOW = "2026-10-06T10:00";

const run = (
	serveAt: string,
	miseEnPlace: (typeof MISE_EN_PLACE_MODES)[number],
	rests: (typeof REST_CHOICES)[number],
) =>
	project([{ graph, options: { miseEnPlace, rests } }], {
		serveAt,
		timeZone: "Europe/Paris",
		availability,
		now: NOW,
	});

const codes = (p: ReturnType<typeof run>) => p.diagnostics.map((d) => d.code);

describe("project matrix (modes x rests x serving time)", () => {
	for (const mode of MISE_EN_PLACE_MODES) {
		for (const rests of REST_CHOICES) {
			it(`${mode} / ${rests}: work stays in availability, ends at service`, () => {
				const plan = run("2026-10-12T19:00", mode, rests);
				const blocks = plan.recipes[0]!.blocks;
				for (const b of blocks.filter((x) => x.kind !== "passive")) {
					const hhmm = (s: string) => s.slice(11, 16);
					expect(hhmm(b.startLocal) >= "08:00").toBe(true);
					expect(hhmm(b.endLocal) <= "22:00").toBe(true);
				}
				expect(
					blocks
						.map((b) => b.endLocal)
						.sort()
						.at(-1),
				).toBe("2026-10-12T19:00");
				expect(codes(plan)).not.toContain("ACTIVE_OUTSIDE_AVAILABILITY");
			});
		}
	}

	it("a deferred preparation never starts before the section that makes its intermediate ends", () => {
		// Only `upfront` defers it: `perSession` gathers it with the day it is used.
		const blocks = run("2026-10-12T19:00", "upfront", "shortest").recipes[0]!
			.blocks;
		const batter = blocks.find((b) => b.task === "s1.prep.batter")!;
		const lastOfSection0 = blocks
			.filter((b) => b.section === 0 && b.kind === "step")
			.map((b) => b.endLocal)
			.sort()
			.at(-1)!;
		expect(batter.startLocal >= lastOfSection0).toBe(true);
	});

	it("upfront gathers the raw preparations first and defers only intermediates", () => {
		const blocks = run("2026-10-12T19:00", "upfront", "shortest").recipes[0]!
			.blocks;
		const preps = blocks.filter((b) => b.kind === "prep");
		expect(preps.filter((b) => !("deferred" in b && b.deferred))).toHaveLength(
			2,
		);
		expect(preps.filter((b) => "deferred" in b && b.deferred)).toHaveLength(2);
	});

	it("upfront does not report a day mismatch for its single long session", () => {
		const plan = run("2026-10-12T19:00", "upfront", "shortest");
		expect(codes(plan)).not.toContain("SESSION_DAY_MISMATCH");
	});

	it("the longest rest cannot be served tomorrow; the shortest can", () => {
		const longest = run("2026-10-07T19:00", "perSection", "longest");
		expect(codes(longest)).toContain("START_IN_PAST");
		const shortest = run("2026-10-07T19:00", "perSection", "shortest");
		expect(codes(shortest)).toEqual([]);
		expect(shortest.recipes[0]!.blocks[0]!.startLocal).toBe("2026-10-06T17:54");
	});

	it("serving today is in the past for any rest", () => {
		for (const rests of REST_CHOICES) {
			expect(codes(run("2026-10-06T19:00", "perSection", rests))).toContain(
				"START_IN_PAST",
			);
		}
	});
});
