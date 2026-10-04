import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import {
	applyScale,
	type CompilationResult,
	compile,
	type ScheduleBlock,
	SCHEDULE_MODES,
} from "../src/index";

/*
 * Property test for the mise en place and the schedules: random recipes
 * (from a seeded generator, so a failure is reproducible) must all satisfy the
 * invariants below. It grew out of the 1.4.0 audit, whose 29,000-recipe run
 * found the empty-section and duplicated-warning bugs that hand-written cases
 * had missed. The generator leans on the hard spots: sections without steps,
 * names shared by an ingredient, a piece of cookware and an intermediate,
 * retro-planning, named timer tracks, alternatives, composites, comments.
 */

// Small seeded RNG (LCG): same seed, same recipes, on every machine.
function makeRng(seed: number) {
	let state = seed >>> 0;
	const next = () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 2 ** 32;
	};
	const pick = <T>(items: readonly T[]): T =>
		items[Math.floor(next() * items.length)] as T;
	return { next, pick, chance: (p: number) => next() < p };
}
type Rng = ReturnType<typeof makeRng>;

const INGREDIENTS = [
	"flour",
	"water",
	"salt",
	"butter",
	"sugar",
	"eggs",
	"pan",
];
const COOKWARE = ["bowl", "pan", "oven", "salt"]; // `pan` and `salt` collide with ingredients
const INTERMEDIATES = ["dough", "sauce", "mix", "flour"]; // `flour` collides too
const TRACKS = ["oven", "fridge"];
const PREPARATIONS = ["sifted", "cut in cubes", "chopped"];

function token(rng: Rng, defined: string[]): string {
	const { next, pick, chance } = rng;
	const r = next();
	if (r < 0.3) {
		const prep = chance(0.35) ? `(${pick(PREPARATIONS)})` : "";
		return `@${pick(INGREDIENTS)}{${pick(["100g", "2", "1 cup", ""])}}${prep}`;
	}
	if (r < 0.42) return `#${pick(COOKWARE)}`;
	if (r < 0.57) {
		const name = pick(chance(0.8) && defined.length ? defined : INTERMEDIATES);
		return `&${name}${chance(0.3) ? "{100g}" : ""}`;
	}
	if (r < 0.67) return `~{${pick(["5min", "10min", "1h", "20s"])}}`;
	if (r < 0.8) return `~_{${pick(["30min", "2h", "1d"])}}`;
	if (r < 0.88) return `~_${pick(TRACKS)}{${pick(["20min", "45min"])}}`;
	if (r < 0.92)
		return `@butter{50g}|@margarine{50g}${chance(0.4) ? "(soft)" : ""}`;
	if (r < 0.96) return `@lemon zest{1}<@lemon${chance(0.5) ? "{2}" : ""}`;
	return "^{180C}";
}

function recipe(rng: Rng): string {
	const { next, pick, chance } = rng;
	const out: string[] = [];
	const defined: string[] = [];
	const sections = Math.max(1, Math.floor(next() * 5));
	const headerless = chance(0.1);
	for (let s = 0; s < sections; s++) {
		let declared: string | null = null;
		if (!headerless || s > 0) {
			declared = chance(0.45) ? pick(INTERMEDIATES) : null;
			const retro = chance(0.2)
				? ` ~{${pick(["-2d", "-3h", "-30min", "+1h", "soon"])}}`
				: "";
			const title = pick(["Dough", "Sauce", "Bake", "Assembly", "Dough"]);
			out.push(`## ${title}${declared ? ` ->&${declared}` : ""}${retro}`, "");
		}
		const steps = Math.floor(next() * 4); // a section may have none
		for (let k = 0; k < steps; k++) {
			if (chance(0.15)) out.push("// a note", "");
			const parts = [chance(0.6) ? `[${pick(["Mix", "Bake", "Rest"])}]` : "Do"];
			for (let t = Math.floor(next() * 4); t > 0; t--) {
				parts.push("and", token(rng, defined));
			}
			if (chance(0.12)) {
				const name = pick(INTERMEDIATES);
				parts.push(`->&${name}`);
				defined.push(name);
			}
			out.push(`${parts.join(" ")}.`, "");
		}
		if (declared) defined.push(declared);
	}
	return out.join("\n");
}

const EPS = 1e-9;
const overlaps = (a: ScheduleBlock, b: ScheduleBlock) =>
	a.start < b.end && b.start < a.end;
const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);

/** Every invariant a compiled recipe must satisfy; one message per breach. */
function violationsOf(result: CompilationResult, source: string): string[] {
	const bad: string[] = [];
	const { miseEnPlace, schedules, metrics, sections, registry } = result;
	const prep = metrics.preparationTime;
	const active = metrics.activeTime;
	const hasRealStep = (i: number) =>
		sections[i]?.steps.some((s) => s.type === "step") ?? false;

	// The sections' costs add up to the preparation time, and each is the sum of its items.
	const sum = miseEnPlace.reduce((a, m) => a + m.duration, 0);
	if (sum !== prep)
		bad.push(`sum(miseEnPlace) ${sum} != preparationTime ${prep}`);
	for (const m of miseEnPlace) {
		if (m.duration !== m.items.reduce((a, i) => a + i.duration, 0)) {
			bad.push(`section ${m.section}: duration != sum(items)`);
		}
		if (!hasRealStep(m.section)) {
			bad.push(`section ${m.section} has a cost but no real step`);
		}
		for (const item of m.items) {
			if (item.kind !== "prepare") continue;
			const known =
				item.ref.type === "cookware" ? registry.cookware : registry.ingredients;
			if (!known[item.ref.id])
				bad.push(`prepare ref ${item.ref.id} not in registry`);
		}
	}

	for (const mode of SCHEDULE_MODES) {
		const s = schedules[mode];
		const preps = s.blocks.filter((b) => b.kind === "prep");
		const steps = s.blocks.filter((b) => b.kind === "step");

		// Every section with a cost has prep blocks as long as its cost in all:
		// one block, or two in `upfront` when it also gathers an intermediate.
		const prepSections = [...new Set(preps.map((b) => b.section))].sort(
			(x, y) => x - y,
		);
		if (prepSections.join() !== miseEnPlace.map((m) => m.section).join()) {
			bad.push(`${mode}: prep blocks != miseEnPlace entries`);
		}
		for (const m of miseEnPlace) {
			const blocks = preps.filter((p) => p.section === m.section);
			const length = blocks.reduce((a, p) => a + p.end - p.start, 0);
			if (Math.abs(length - m.duration) > EPS) {
				bad.push(
					`${mode}: prep blocks of section ${m.section} have the wrong length`,
				);
			}
			if (mode === "perSection" && blocks.length !== 1) {
				bad.push(`perSection: section ${m.section} has ${blocks.length} preps`);
			}
		}

		// Times are real numbers and add up: total = prep + active + idle = last block's end.
		if (!finite(s.totalTime) || !finite(s.idleTime))
			bad.push(`${mode}: non-finite time`);
		if (s.idleTime < -EPS) bad.push(`${mode}: idleTime ${s.idleTime} < 0`);
		if (Math.abs(s.totalTime - (prep + active + s.idleTime)) > EPS) {
			bad.push(`${mode}: total != prep + active + idle`);
		}
		const maxEnd = s.blocks.reduce((m, b) => Math.max(m, b.end), 0);
		if (Math.abs(maxEnd - s.totalTime) > EPS)
			bad.push(`${mode}: total != max(end)`);

		// Blocks are sorted, finite, ahead of T0 and point at real steps.
		let previous: ScheduleBlock | undefined;
		for (const b of s.blocks) {
			if (!finite(b.start) || !finite(b.end))
				bad.push(`${mode}: non-finite block`);
			if (b.start < -EPS || b.end < b.start - EPS)
				bad.push(`${mode}: bad block`);
			if (previous && b.start < previous.start - EPS)
				bad.push(`${mode}: unsorted blocks`);
			previous = b;
			if (
				b.kind !== "prep" &&
				sections[b.section]?.steps[b.step]?.type !== "step"
			) {
				bad.push(`${mode}: block points at no step`);
			}
		}

		// With one cook: the steps add up to the active time and never overlap.
		const stepTotal = steps.reduce((a, b) => a + (b.end - b.start), 0);
		if (Math.abs(stepTotal - active) > EPS)
			bad.push(`${mode}: sum(step) != activeTime`);
		for (let x = 0; x < steps.length; x++) {
			for (let y = x + 1; y < steps.length; y++) {
				if (overlaps(steps[x] as ScheduleBlock, steps[y] as ScheduleBlock)) {
					bad.push(`${mode}: two active steps overlap`);
				}
			}
		}
		// Sessions come furthest day first, within the timeline.
		for (let i = 0; i < s.sessions.length; i++) {
			const session = s.sessions[i] as (typeof s.sessions)[number];
			if (i > 0 && (s.sessions[i - 1]?.day ?? 0) <= session.day) {
				bad.push(`${mode}: sessions not ordered by day`);
			}
			if (
				session.start > session.end + EPS ||
				session.end > s.totalTime + EPS
			) {
				bad.push(`${mode}: session outside the timeline`);
			}
		}
		// ...and, by section, a preparation never overlaps a step either.
		if (mode === "perSection") {
			for (const p of preps) {
				if (steps.some((st) => overlaps(p, st)))
					bad.push("perSection: a prep overlaps a step");
			}
		}
	}

	// Upfront is the legacy timeline pushed back by the preparation, except for
	// what concerns an intermediate: that is gathered once it exists, so it can
	// only make the timeline shorter.
	const hasIntermediate = miseEnPlace.some((m) =>
		m.items.some((i) =>
			i.kind === "gather" ? (i.intermediates ?? 0) > 0 : i.intermediate,
		),
	);
	if (schedules.upfront.totalTime > metrics.totalTime + EPS) {
		bad.push("upfront total > metrics.totalTime");
	}
	if (
		!hasIntermediate &&
		Math.abs(schedules.upfront.totalTime - metrics.totalTime) > EPS
	) {
		bad.push("upfront total != metrics.totalTime");
	}
	for (const b of schedules.upfront.blocks) {
		if (b.kind !== "step" || hasIntermediate) continue;
		const step = sections[b.section]?.steps[b.step];
		if (
			step?.type === "step" &&
			(Math.abs(b.start - (step.timings.start + prep)) > EPS ||
				Math.abs(b.end - (step.timings.end + prep)) > EPS)
		) {
			bad.push("upfront step != legacy timings + preparation");
		}
	}

	// A recipe on a single working day plans per session exactly like upfront.
	if (
		schedules.perSession.sessions.length <= 1 &&
		JSON.stringify(schedules.perSession.blocks) !==
			JSON.stringify(schedules.upfront.blocks)
	) {
		bad.push("single-session perSession != upfront");
	}

	// Compiling is deterministic, scaling never moves a duration, and scaling a
	// compiled result gives what compiling with that factor gives (documented).
	if (JSON.stringify(compile(getAST(source))) !== JSON.stringify(result)) {
		bad.push("compile is not deterministic");
	}
	const scaled = compile(getAST(source), { scaleFactor: 2 });
	const applied = applyScale(result, 2);
	for (const other of [scaled, applied]) {
		if (
			JSON.stringify(other.schedules) !== JSON.stringify(schedules) ||
			JSON.stringify(other.miseEnPlace) !== JSON.stringify(miseEnPlace)
		) {
			bad.push("scaling changes schedules or miseEnPlace");
		}
	}
	if (JSON.stringify(applied) !== JSON.stringify(scaled)) {
		bad.push("applyScale differs from compile({ scaleFactor })");
	}
	return bad;
}

describe("schedules: properties over random recipes", () => {
	const SEEDS = [1, 2, 3];
	const PER_SEED = 200;

	it(`keeps every invariant on ${SEEDS.length * PER_SEED} generated recipes`, () => {
		const breaches = new Map<string, string>(); // message -> smallest recipe showing it
		let compiled = 0;
		for (const seed of SEEDS) {
			const rng = makeRng(seed);
			for (let i = 0; i < PER_SEED; i++) {
				const source = recipe(rng);
				let result: CompilationResult;
				try {
					result = compile(getAST(source));
				} catch (e) {
					// The generator now and then writes a recipe the language rejects
					// (`~{soon}`, an impossible baker's formula): not a bug.
					if (!/Syntax|BAKERS|Invalid/i.test(String(e))) {
						breaches.set(`threw: ${String(e).slice(0, 120)}`, source);
					}
					continue;
				}
				compiled++;
				for (const message of violationsOf(result, source)) {
					const seen = breaches.get(message);
					if (seen === undefined || source.length < seen.length) {
						breaches.set(message, source);
					}
				}
			}
		}
		// Not vacuous: most recipes have to compile for the properties to mean anything.
		expect(compiled).toBeGreaterThan(SEEDS.length * PER_SEED * 0.8);
		expect(
			[...breaches].map(([message, source]) => `${message}\n${source}`),
		).toEqual([]);
	}, 60_000); // generous: a CI runner is several times slower than a laptop
});
