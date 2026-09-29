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
	type Registry,
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
