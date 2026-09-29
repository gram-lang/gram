import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as posix from "node:path/posix";
import { fileURLToPath } from "node:url";
import {
	type CompilationResult,
	type CompilerOptions,
	compile,
	computeMiseEnPlace,
	type ProcessedStep,
	type Registry,
	type Schedule,
} from "@gram-lang/kitchen";
import {
	composeRecipe,
	finalizeComposed,
	loadModuleGraph,
	type ModuleHost,
} from "@gram-lang/modules";
import { getAST } from "@gram-lang/parser";

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, "cases");
const KITCHEN_FIXTURES = join(
	HERE,
	"..",
	"packages",
	"kitchen",
	"tests",
	"fixtures",
	"valid",
);
const ENTRY_URI = "input.gram";

// Same host as run.ts: `@use` specifiers resolve inside the case directory.
function createCaseHost(dir: string): ModuleHost {
	return {
		resolve(specifier, fromUri) {
			const base = specifier.startsWith("@/")
				? specifier.slice(2)
				: posix.join(posix.dirname(fromUri), specifier);
			return posix.normalize(base);
		},
		read: (uri) => readFileSync(join(dir, uri), "utf-8"),
	};
}

async function compileDir(
	dir: string,
	entry: string,
): Promise<CompilationResult | null> {
	const optionsPath = join(dir, "options.json");
	const options = existsSync(optionsPath)
		? (JSON.parse(readFileSync(optionsPath, "utf-8")) as {
				compilerOptions?: CompilerOptions;
				composeOptions?: { stock?: string[] };
			})
		: {};
	try {
		const host = createCaseHost(dir);
		const graph = await loadModuleGraph(entry, host);
		const stock = options.composeOptions?.stock
			? new Set(options.composeOptions.stock.map((s) => host.resolve(s, entry)))
			: undefined;
		const composed = composeRecipe(graph, { db: {}, stock });
		return finalizeComposed(
			compile(composed.ast, options.compilerOptions),
			composed,
		);
	} catch {
		// Expected parse/scale/module failures (err-*, mod-008/009/…): no compiled output to check.
		return null;
	}
}

function toRegistry(compiled: CompilationResult): Registry {
	return {
		ingredients: new Map(Object.entries(compiled.registry.ingredients)),
		cookware: new Map(Object.entries(compiled.registry.cookware)),
		warnings: [],
	};
}

function checkInvariants(compiled: CompilationResult): void {
	checkSchedules(compiled);
	const registry = toRegistry(compiled);
	const mise = computeMiseEnPlace(compiled.sections, registry);

	// Invariant 2: a section's duration is the sum of its items.
	for (const entry of mise) {
		expect(entry.duration).toBe(
			entry.items.reduce((sum, i) => sum + i.duration, 0),
		);
		expect(entry.duration).toBeGreaterThan(0);
	}

	// Sections come in ascending order, once each, and only sections with
	// real steps (empty / comment-only sections carry no mise en place).
	const indices = mise.map((m) => m.section);
	expect(indices).toEqual([...new Set(indices)].sort((a, b) => a - b));
	const hasRealSteps = compiled.sections.some((s) =>
		s.steps.some((st) => st.type === "step"),
	);
	for (const idx of indices) {
		expect(compiled.sections[idx].steps.some((st) => st.type === "step")).toBe(
			true,
		);
	}

	// Every registry ingredient/cookware is gathered exactly once.
	let gatheredIngredients = 0;
	let gatheredCookware = 0;
	for (const entry of mise) {
		for (const item of entry.items) {
			if (item.kind === "gather") {
				if (item.target === "ingredient") gatheredIngredients += item.count;
				else gatheredCookware += item.count;
				expect(item.duration).toBe(item.count);
			} else {
				const known =
					item.ref.type === "cookware"
						? registry.cookware
						: registry.ingredients;
				expect(known.has(item.ref.id)).toBe(true);
			}
		}
	}

	// Invariant 1: Σ sections == metrics.preparationTime.
	if (hasRealSteps) {
		expect(gatheredIngredients).toBe(registry.ingredients.size);
		expect(gatheredCookware).toBe(registry.cookware.size);
		expect(mise.reduce((sum, m) => sum + m.duration, 0)).toBe(
			compiled.metrics.preparationTime,
		);
	}
}

const overlaps = (
	a: { start: number; end: number },
	b: { start: number; end: number },
) => a.start < b.end && b.start < a.end;

function checkSchedules(compiled: CompilationResult): void {
	const { miseEnPlace, schedules, metrics, sections } = compiled;
	const preparation = metrics.preparationTime;

	// The compiled field is the same fact computeMiseEnPlace derives.
	expect(miseEnPlace).toEqual(
		computeMiseEnPlace(sections, toRegistry(compiled)),
	);

	for (const [mode, schedule] of Object.entries(schedules) as Array<
		[string, Schedule]
	>) {
		// Invariant 3: a prep block per mise en place entry, of the right length.
		const prep = schedule.blocks.filter((b) => b.kind === "prep");
		expect(prep.map((b) => b.section).sort((a, b) => a - b)).toEqual(
			miseEnPlace.map((m) => m.section),
		);
		for (const b of prep) {
			const entry = miseEnPlace.find((m) => m.section === b.section);
			expect(b.end - b.start).toBe(entry?.duration);
		}

		// Invariant 4: the three times add up, and nothing is negative.
		expect(schedule.idleTime).toBeGreaterThanOrEqual(0);
		expect(schedule.totalTime).toBe(
			preparation + metrics.activeTime + schedule.idleTime,
		);
		expect(schedule.totalTime).toBe(
			schedule.blocks.reduce((max, b) => Math.max(max, b.end), 0),
		);

		// Blocks are sorted by start, then end.
		for (let i = 1; i < schedule.blocks.length; i++) {
			const [a, b] = [schedule.blocks[i - 1], schedule.blocks[i]];
			expect(a.start < b.start || (a.start === b.start && a.end <= b.end)).toBe(
				true,
			);
		}

		// Every step block points at a real, non-comment step.
		for (const b of schedule.blocks) {
			if (b.kind === "prep") continue;
			expect(sections[b.section].steps[b.step]?.type).toBe("step");
		}
		expect(mode).toMatch(/perSection|upfront/);
	}

	// Invariant 5: upfront is the legacy timeline pushed back by the preparation.
	const upfront = schedules.upfront;
	expect(upfront.totalTime).toBe(metrics.totalTime);
	for (const b of upfront.blocks) {
		if (b.kind !== "step") continue;
		const step = sections[b.section].steps[b.step] as ProcessedStep;
		expect(b.start).toBe(step.timings.start + preparation);
		expect(b.end).toBe(step.timings.end + preparation);
	}
	const expectedPassives: number[] = [];
	for (const sec of sections) {
		for (const st of sec.steps) {
			if (st.type !== "step") continue;
			for (const bg of st.backgroundTasks ?? []) {
				expectedPassives.push(st.timings.start + bg.startOffset + preparation);
			}
		}
	}
	expect(
		upfront.blocks
			.filter((b) => b.kind === "passive")
			.map((b) => b.start)
			.sort((a, b) => a - b),
	).toEqual(expectedPassives.sort((a, b) => a - b));

	// Invariant 6: with one cook, a preparation never overlaps a step, and the
	// steps add up to the active time.
	const perSection = schedules.perSection;
	const steps = perSection.blocks.filter((b) => b.kind === "step");
	for (const p of perSection.blocks.filter((b) => b.kind === "prep")) {
		for (const st of steps) expect(overlaps(p, st)).toBe(false);
	}
	expect(steps.reduce((sum, b) => sum + (b.end - b.start), 0)).toBe(
		metrics.activeTime,
	);
}

describe("mise en place per section", () => {
	const cases = readdirSync(CASES_DIR).filter((n) =>
		existsSync(join(CASES_DIR, n, ENTRY_URI)),
	);
	for (const name of cases) {
		it(`conformance case ${name}`, async () => {
			const compiled = await compileDir(join(CASES_DIR, name), ENTRY_URI);
			if (compiled) checkInvariants(compiled);
		});
	}

	for (const file of readdirSync(KITCHEN_FIXTURES).filter((f) =>
		f.endsWith(".gram"),
	)) {
		it(`kitchen fixture ${file}`, () => {
			const source = readFileSync(join(KITCHEN_FIXTURES, file), "utf-8");
			checkInvariants(compile(getAST(source)));
		});
	}

	it("sees a substantial corpus", () => {
		expect(cases.length).toBeGreaterThan(50);
	});
});
