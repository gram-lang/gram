#!/usr/bin/env bun
/**
 * Conformance runner. For every case in cases/<name>/, runs the reference
 * pipeline (getAST -> compile -> analyze) or captures the thrown parse error,
 * and compares the result against the golden JSON files checked into the
 * case directory. Any implementation of the Gram pipeline — this one or a
 * future Rust port — must produce byte-identical goldens to be conformant.
 *
 * Usage:
 *   bun run run.ts             # verify all cases against their goldens
 *   bun run run.ts --update    # (re)write goldens from the current pipeline
 *   bun run run.ts 004         # only run cases whose dirname contains "004"
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	analyze,
	validateIngredientDatabase,
	type AnalyzerOptions,
	type IngredientData,
} from "@gram-lang/analyzer";
import {
	compile,
	resolveScaleFactor,
	ScaleError,
	type CompilerOptions,
} from "@gram-lang/kitchen";
import { GramParseError, getAST } from "@gram-lang/parser";

const CASES_DIR = join(dirname(fileURLToPath(import.meta.url)), "cases");

const args = process.argv.slice(2);
const update = args.includes("--update");
const filters = args.filter((a) => a !== "--update");

function toJSON(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

interface CaseOptions {
	compilerOptions?: CompilerOptions;
	scaleTarget?: { id: string; qty: number; unit?: string | null };
	analyzerOptions?: AnalyzerOptions;
}

// Optional per-case input, read *before* the pipeline's try/catch: a
// malformed fixture is a broken case definition, not a golden mismatch, so
// it must throw loudly rather than get silently recorded as an error.json.
function loadCaseOptions(caseDir: string): CaseOptions {
	const path = join(caseDir, "options.json");
	if (!existsSync(path)) return {};
	return JSON.parse(readFileSync(path, "utf-8"));
}

function loadCaseDatabase(caseDir: string): Record<string, IngredientData> {
	const path = join(caseDir, "database.json");
	if (!existsSync(path)) return {};
	const raw = JSON.parse(readFileSync(path, "utf-8"));
	const { data, rejected } = validateIngredientDatabase(raw);
	if (rejected.length > 0) {
		throw new Error(`${path} has invalid entries: ${JSON.stringify(rejected)}`);
	}
	return data;
}

function writeOrCompare(
	path: string,
	actual: string,
	diffs: string[],
	label: string,
): void {
	if (update || !existsSync(path)) {
		writeFileSync(path, actual);
		return;
	}
	const expected = readFileSync(path, "utf-8");
	if (expected !== actual) {
		diffs.push(`${label} does not match golden (${path})`);
	}
}

function runCase(name: string): { ok: boolean; diffs: string[] } {
	const caseDir = join(CASES_DIR, name);
	const source = readFileSync(join(caseDir, "input.gram"), "utf-8");
	const errorGoldenPath = join(caseDir, "error.json");
	const diffs: string[] = [];

	const caseOptions = loadCaseOptions(caseDir);
	// Empty by default: exercises the deterministic "no data available" path
	// (missing mass, no nutrition) common to every case that doesn't opt into
	// a database.json fixture.
	const database = loadCaseDatabase(caseDir);

	try {
		const ast = getAST(source);
		let compiled = compile(ast, caseOptions.compilerOptions);

		if (caseOptions.scaleTarget) {
			const resolution = resolveScaleFactor(compile(ast), {
				type: "target",
				id: caseOptions.scaleTarget.id,
				qty: caseOptions.scaleTarget.qty,
				unit: caseOptions.scaleTarget.unit ?? null,
			});
			compiled = compile(ast, { scaleFactor: resolution.factor });
		}

		const { result: analyzed } = analyze(
			compiled,
			database,
			caseOptions.analyzerOptions,
		);

		// The pipeline ran end-to-end without throwing: only now do we know this
		// is a "success" case, so only now do we write its goldens. Deferring
		// this until the whole pipeline completes keeps a case that throws
		// partway through (a parse error, or a scale error thrown after a
		// successful parse) from leaving a stray ast.json/compiled.json behind —
		// an error case has *only* error.json, per the case-directory contract.
		if (!update && existsSync(errorGoldenPath)) {
			diffs.push(
				"expected a thrown error (error.json is present) but the pipeline completed successfully",
			);
		}

		writeOrCompare(join(caseDir, "ast.json"), toJSON(ast), diffs, "ast.json");
		writeOrCompare(
			join(caseDir, "compiled.json"),
			toJSON(compiled),
			diffs,
			"compiled.json",
		);
		writeOrCompare(
			join(caseDir, "analyzed.json"),
			toJSON(analyzed),
			diffs,
			"analyzed.json",
		);
	} catch (e) {
		const info = {
			message: e instanceof Error ? e.message : String(e),
			offset: e instanceof GramParseError ? e.offset : null,
			expected: e instanceof GramParseError ? e.expected : null,
			code: e instanceof ScaleError ? e.code : null,
		};
		writeOrCompare(errorGoldenPath, toJSON(info), diffs, "error.json");
	}

	return { ok: diffs.length === 0, diffs };
}

const allCases = readdirSync(CASES_DIR, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name)
	.sort();

const cases = filters.length
	? allCases.filter((name) => filters.some((f) => name.includes(f)))
	: allCases;

if (cases.length === 0) {
	console.error(`No case matches filter(s): ${filters.join(", ")}`);
	process.exit(1);
}

let failed = 0;
for (const name of cases) {
	const { ok, diffs } = runCase(name);
	if (ok) {
		console.log(`  ok    ${name}`);
	} else {
		failed++;
		console.log(`  FAIL  ${name}`);
		for (const d of diffs) console.log(`          - ${d}`);
	}
}

const verb = update ? "updated" : "checked";
console.log(`\n${cases.length - failed}/${cases.length} cases ${verb}.`);

if (!update && failed > 0) {
	console.log(
		"\nIf this change is intentional, re-run with --update, review the",
		"resulting git diff carefully, and commit the new goldens.",
	);
	process.exit(1);
}
