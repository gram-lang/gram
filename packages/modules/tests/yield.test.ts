import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile, type Warning } from "@gram-lang/kitchen";
import { analyze } from "@gram-lang/analyzer";
import { computeExports } from "../src/exports";
import {
	parseDeclaredYields,
	resolveYield,
	computeScaleFactor,
} from "../src/yield";

const db = {};

function analyzeSource(source: string) {
	return analyze(compile(getAST(source)), db).result;
}

// Phase D.1/D.2 of the module-imports RFC: yield resolution per export and
// the scale-factor derivation. These are the three non-regression scenarios
// the RFC's own §F.3 calls out by name, plus the declared-yields fast path.

describe("parseDeclaredYields", () => {
	it("parses a scalar yield as the default export", () => {
		const parsed = parseDeclaredYields({ yields: "500g" });
		expect(parsed.get("default")).toEqual({ value: 500, unit: "g" });
	});

	it("parses a bare-count scalar yield with no unit", () => {
		const parsed = parseDeclaredYields({ yields: "1 tarte" });
		expect(parsed.get("default")).toEqual({ value: 1, unit: "tarte" });
	});

	it("parses the array form, keyed by export name", () => {
		const parsed = parseDeclaredYields({
			yields: ["blancs:100g", "jaunes:50g"],
		});
		expect(parsed.get("blancs")).toEqual({ value: 100, unit: "g" });
		expect(parsed.get("jaunes")).toEqual({ value: 50, unit: "g" });
	});

	it("returns an empty map when yields: is absent", () => {
		expect(parseDeclaredYields({}).size).toBe(0);
	});
});

describe("resolveYield", () => {
	it("uses a declared yield without measuring anything", () => {
		const analyzed = analyzeSource("## Pastry ->&paton\n\nMix @flour{1g}.\n");
		const { exports } = computeExports(
			getAST("## Pastry ->&paton\n\nMix @flour{1g}.\n"),
		);
		const declared = parseDeclaredYields({ yields: "500g" });

		const resolved = resolveYield(
			analyzed,
			exports.get("default")!,
			"default",
			declared,
		);
		expect(resolved).toEqual({
			value: 500,
			unit: "g",
			family: "mass",
			status: "precise",
		});
	});

	it("measures the default export's mass when nothing is declared", () => {
		const source = "## Pastry ->&paton\n\nMix @flour{200g} and @water{50g}.\n";
		const analyzed = analyzeSource(source);
		const { exports } = computeExports(getAST(source));

		const resolved = resolveYield(
			analyzed,
			exports.get("default")!,
			"default",
			new Map(),
		);
		expect(resolved.value).toBe(250);
		expect(resolved.status).toBe("precise");
	});

	// RFC §F.3, non-regression #5: an export whose section only *references*
	// another intermediate must still report the full mass, not just its own
	// section's direct ingredients.
	it("recursively includes a referenced intermediate's mass (meringue = &blancs + sugar)", () => {
		const source = `## Blancs ->&blancs

Separate @egg{100g}.

## Meringue ->&meringue

Whisk &blancs with @sugar{50g}.
`;
		const analyzed = analyzeSource(source);
		const { exports } = computeExports(getAST(source));

		const resolved = resolveYield(
			analyzed,
			exports.get("meringue")!,
			"meringue",
			new Map(),
		);
		expect(resolved.value).toBe(150);
	});
});

describe("computeScaleFactor", () => {
	function setup(moduleSource: string) {
		const ast = getAST(moduleSource);
		const { exports } = computeExports(ast);
		const analyzed = analyzeSource(moduleSource);
		return { exports, analyzed };
	}

	it("defaults to factor 1 when no binding is ever quantified", () => {
		const { exports, analyzed } = setup(
			"## Pastry ->&paton\n\nMix @flour{200g}.\n",
		);
		const hostAst = getAST('@use "./p.gram" as &pate\n\nUse &pate.\n');
		const warnings: Warning[] = [];

		const factor = computeScaleFactor(
			hostAst.children,
			hostAst.imports[0]!,
			exports,
			analyzed,
			new Map(),
			{},
			warnings,
		);
		expect(factor).toBe(1);
		expect(warnings).toEqual([]);
	});

	// RFC §F.3, non-regression #3: dividing by the export's own yield, never
	// by the whole module's totalMass, is what makes {100g} against a 100g
	// export come back as factor 1 (not 0.66 against some larger whole).
	it("derives the factor from the ratio of requested to yielded quantity", () => {
		const { exports, analyzed } = setup(
			"## Pastry ->&paton\n\nMix @flour{200g}.\n",
		);
		const hostAst = getAST('@use "./p.gram" as &pate\n\nUse &pate{400g}.\n');
		const warnings: Warning[] = [];

		const factor = computeScaleFactor(
			hostAst.children,
			hostAst.imports[0]!,
			exports,
			analyzed,
			new Map(),
			{},
			warnings,
		);
		expect(factor).toBe(2);
	});

	// RFC §F.3, non-regression #4: two destructured bindings each requesting
	// a different amount take the *max* ratio, and the shortfall on the
	// other is reported as a surplus, not an error.
	it("takes the max ratio across destructured bindings and reports the surplus", () => {
		const moduleSource = `## Blancs ->&blancs

Separate @egg{100g}.

## Jaunes ->&jaunes

Separate @egg{50g}.
`;
		const { exports, analyzed } = setup(moduleSource);
		const hostAst = getAST(
			'@use "./oeufs.gram" as { &blancs, &jaunes }\n\nUse &blancs{200g} and &jaunes{50g}.\n',
		);
		const warnings: Warning[] = [];

		const factor = computeScaleFactor(
			hostAst.children,
			hostAst.imports[0]!,
			exports,
			analyzed,
			new Map(),
			{},
			warnings,
		);
		expect(factor).toBe(2);
		const surplus = warnings.find((w) => w.code === "MODULE_SURPLUS");
		expect(surplus).toBeDefined();
		expect(surplus.message).toContain("jaunes");
	});

	it("interprets a bare number against a mass yield as a batch count", () => {
		const { exports, analyzed } = setup(
			"## Cookies ->&cookies\n\nMix @flour{500g}.\n",
		);
		const hostAst = getAST('@use "./c.gram" as &cookies\n\nUse &cookies{3}.\n');
		const warnings: Warning[] = [];

		const factor = computeScaleFactor(
			hostAst.children,
			hostAst.imports[0]!,
			exports,
			analyzed,
			new Map(),
			{},
			warnings,
		);
		expect(factor).toBe(3);
		expect(warnings.map((w) => w.code)).toContain(
			"MODULE_BATCH_INTERPRETATION",
		);
	});

	it("reports MODULE_UNIT_MISMATCH for an unconvertible cross-family request", () => {
		const { exports, analyzed } = setup(
			"## Cookies ->&cookies\n\nMix @flour{500g}.\n",
		);
		const hostAst = getAST(
			'@use "./c.gram" as &cookies\n\nUse &cookies{250ml}.\n',
		);
		const warnings: Warning[] = [];

		computeScaleFactor(
			hostAst.children,
			hostAst.imports[0]!,
			exports,
			analyzed,
			new Map(),
			{},
			warnings,
		);
		expect(warnings.map((w) => w.code)).toContain("MODULE_UNIT_MISMATCH");
	});
});
