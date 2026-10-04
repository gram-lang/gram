import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import type { Task, TaskGraph, TimerTask } from "../src/graph";
import { layout } from "../src/layout";
import { project } from "../src/project";
import type { Availability } from "../src/projection";

// Seeded, so a failure can be replayed.
function makeRng(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

function randomGraph(rng: () => number): TaskGraph {
	const pick = <T>(items: T[]) => items[Math.floor(rng() * items.length)]!;
	const sections = 1 + Math.floor(rng() * 3);
	const tasks: Task[] = [];
	const graph: TaskGraph = { tasks, sections: [] };
	for (let s = 0; s < sections; s++) {
		const day = sections - 1 - s;
		const makes = s < sections - 1;
		graph.sections.push({
			day,
			...(rng() < 0.4 && day > 0 && { deadline: day * 1440 }),
			...(makes && { intermediate: `x${s}` }),
		});
		const steps = 1 + Math.floor(rng() * 2);
		for (let i = 0; i < steps; i++) {
			const last = i === steps - 1;
			const active = pick([5, 10, 20, 45]);
			tasks.push({
				id: `s${s}.${i}`,
				kind: "step",
				section: s,
				step: i,
				duration: { nominal: active },
				...(makes && last && { produces: [`x${s}`] }),
				...(s > 0 && i === 0 && { consumes: [`x${s - 1}`] }),
				after: [],
			});
			if (rng() < 0.7) {
				const min = pick([30, 120, 480, 720]);
				const ranged = rng() < 0.6;
				const max = ranged ? min + pick([60, 240, 600, 900]) : min;
				tasks.push({
					id: `s${s}.${i}.t0`,
					kind: "passive",
					section: s,
					step: i,
					...(rng() < 0.3 && { track: "fridge" }),
					offset: active,
					duration: ranged ? { nominal: min, min, max } : { nominal: min },
					after: [`s${s}.${i}`],
				});
			}
		}
	}
	return graph;
}

function randomAvailability(rng: () => number): Availability {
	const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;
	const from = 6 + Math.floor(rng() * 5);
	const to = 18 + Math.floor(rng() * 6);
	return {
		daily: [{ start: hour(from), end: hour(to) }],
		...(rng() < 0.5 && {
			weekdays: { sat: [{ start: "10:00", end: "14:00" }] },
		}),
		...(rng() < 0.3 && { dates: { "2026-10-10": [] } }),
	};
}

const timersOf = (graph: TaskGraph) =>
	new Map(
		graph.tasks
			.filter((t): t is TimerTask => t.kind === "passive")
			.map((t) => [t.id, t]),
	);

describe("project: invariants over random recipes", () => {
	const ALWAYS: Availability = { daily: [{ start: "00:00", end: "24:00" }] };
	const N = 300;

	it("never moves a rest outside its range, nor an exact one", () => {
		const rng = makeRng(7);
		let adjusted = 0;
		for (let i = 0; i < N; i++) {
			const graph = randomGraph(rng);
			const plan = project([{ graph }], {
				serveAt: "2026-10-11T13:00",
				timeZone: "Europe/Paris",
				availability: randomAvailability(rng),
			});
			const timers = timersOf(graph);
			for (const a of plan.adjustments) {
				adjusted++;
				const { min, max } = timers.get(a.task)!.duration;
				expect(min).toBeDefined();
				expect(a.to).toBeGreaterThanOrEqual(min!);
				expect(a.to).toBeLessThanOrEqual(max!);
				expect(a.from).not.toBe(a.to);
			}
		}
		// Not vacuous: the generator has to ask for adjustments now and then.
		expect(adjusted).toBeGreaterThan(10);
	});

	it("without any unavailability, is the layout moved to the serving time", () => {
		const rng = makeRng(11);
		for (let i = 0; i < N; i++) {
			const graph = randomGraph(rng);
			const plan = project([{ graph }], {
				serveAt: "2026-10-11T13:00",
				timeZone: "Europe/Paris",
				availability: ALWAYS,
			});
			const { schedule } = layout(graph);
			expect(plan.adjustments).toEqual([]);
			const blocks = plan.recipes[0]!.blocks;
			expect(blocks).toHaveLength(schedule.blocks.length);
			const shift =
				Date.parse("2026-10-11T11:00:00Z") / 60000 - schedule.totalTime;
			blocks.forEach((b, k) => {
				const expected = schedule.blocks[k]!;
				expect(Date.parse(b.start) / 60000).toBeCloseTo(
					expected.start + shift,
					6,
				);
				expect(Date.parse(b.end) / 60000).toBeCloseTo(expected.end + shift, 6);
				expect(b.task).toBe(expected.task);
			});
		}
	});

	it("keeps every block of the layout, whatever it moves", () => {
		const rng = makeRng(13);
		for (let i = 0; i < N; i++) {
			const graph = randomGraph(rng);
			const plan = project([{ graph }], {
				serveAt: "2026-10-11T13:00",
				timeZone: "Europe/Paris",
				availability: randomAvailability(rng),
			});
			expect(plan.recipes[0]!.blocks.map((b) => b.task).sort()).toEqual(
				layout(graph)
					.schedule.blocks.map((b) => b.task)
					.sort(),
			);
		}
	});

	it("is the same plan twice", () => {
		const rng = makeRng(17);
		for (let i = 0; i < 50; i++) {
			const graph = randomGraph(rng);
			const context = {
				serveAt: "2026-10-11T13:00",
				timeZone: "Europe/Paris",
				availability: randomAvailability(rng),
			};
			expect(JSON.stringify(project([{ graph }], context))).toBe(
				JSON.stringify(project([{ graph }], context)),
			);
		}
	});
});

describe("project: the machine's time zone is irrelevant", () => {
	const script = join(import.meta.dir, "fixtures/project-in-zone.ts");
	const runIn = (TZ: string) => {
		const result = Bun.spawnSync([process.execPath, script], {
			env: { ...process.env, TZ },
		});
		expect(result.exitCode).toBe(0);
		return result.stdout.toString();
	};

	it("gives byte for byte the same plan and sheet under different TZ", () => {
		const reference = runIn("UTC");
		expect(reference.length).toBeGreaterThan(100);
		for (const TZ of [
			"Europe/Paris",
			"America/Los_Angeles",
			"Asia/Tokyo",
			"Pacific/Kiritimati",
			"Australia/Lord_Howe",
		]) {
			expect(runIn(TZ)).toBe(reference);
		}
	});
});
