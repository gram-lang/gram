#!/usr/bin/env bun
/**
 * Conformance runner. For every case in cases/<name>/, runs the reference
 * pipeline (getAST -> compile -> analyze) or captures the thrown parse error,
 * and compares the result against the golden JSON files checked into the
 * case directory. Any implementation of the Gram pipeline — this one or a
 * future Rust port — must produce byte-identical goldens to be conformant.
 *
 * A case may import other `.gram` files (`@use`) — `input.gram` stays the
 * one entry point golden-tested, but its siblings within the case directory
 * are resolvable, through a host confined to (and URI'd relative to) the
 * case directory itself, never an absolute filesystem path — so goldens
 * stay portable across machines (module-imports RFC, Phase F.1).
 *
 * Usage:
 *   bun run run.ts             # verify all cases against their goldens
 *   bun run run.ts --update    # (re)write goldens from the current pipeline
 *   bun run run.ts 004         # only run cases whose dirname contains "004"
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as posix from "node:path/posix";
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
import {
	loadModuleGraph,
	composeRecipe,
	finalizeComposed,
	type ModuleHost,
} from "@gram-lang/modules";

const CASES_DIR = join(dirname(fileURLToPath(import.meta.url)), "cases");
const ENTRY_URI = "input.gram";

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

/**
 * Resolves `@use` specifiers relative to the *case directory*, never an
 * absolute filesystem path — a golden JSON embedding this machine's repo
 * path would break the moment another machine (or CI) ran the same case.
 * URIs are POSIX-style relative paths like "bases/pate.gram", confined to
 * the case directory the same way the CLI host confines to the project
 * root.
 */
function createCaseHost(caseDir: string): ModuleHost {
	return {
		resolve(specifier: string, fromUri: string): string {
			// "@/rest.gram" resolves against the case directory itself — the
			// same role `projectRoot` plays for the CLI host (module-imports
			// RFC §B.1). Named "@alias/" paths aren't exercised here: that
			// aliasing is CLI config (`.gram/config.yaml`'s `paths:`), not a
			// pipeline-level concept a conformance case needs to pin down.
			const base = specifier.startsWith("@/")
				? specifier.slice(2)
				: posix.join(posix.dirname(fromUri), specifier);
			const resolved = posix.normalize(base);
			if (resolved.startsWith("..")) {
				throw new Error(`"${specifier}" resolves outside the case directory.`);
			}
			return resolved;
		},
		read(uri: string): string {
			return readFileSync(join(caseDir, uri), "utf-8");
		},
	};
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

async function runCase(
	name: string,
): Promise<{ ok: boolean; diffs: string[] }> {
	const caseDir = join(CASES_DIR, name);
	const source = readFileSync(join(caseDir, ENTRY_URI), "utf-8");
	const errorGoldenPath = join(caseDir, "error.json");
	const diffs: string[] = [];

	const caseOptions = loadCaseOptions(caseDir);
	// Empty by default: exercises the deterministic "no data available" path
	// (missing mass, no nutrition) common to every case that doesn't opt into
	// a database.json fixture.
	const database = loadCaseDatabase(caseDir);

	try {
		// ast.json stays getAST(input.gram) alone — a pure, single-file
		// operation, and the one golden every case has regardless of whether
		// it imports anything. Composition happens only for compiled/analyzed.
		const ast = getAST(source);

		const host = createCaseHost(caseDir);
		const graph = await loadModuleGraph(ENTRY_URI, host);
		const composed = composeRecipe(graph, { db: database });

		let compiled = compile(composed.ast, caseOptions.compilerOptions);

		if (caseOptions.scaleTarget) {
			const resolution = resolveScaleFactor(compile(composed.ast), {
				type: "target",
				id: caseOptions.scaleTarget.id,
				qty: caseOptions.scaleTarget.qty,
				unit: caseOptions.scaleTarget.unit ?? null,
			});
			compiled = compile(composed.ast, { scaleFactor: resolution.factor });
		}

		compiled = finalizeComposed(compiled, composed);

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
			// Always present (never omitted) so error.json keeps one shape
			// across every case — null except when a thrown error can be
			// attributed to a specific module file rather than the entry.
			file: null as string | null,
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
	const { ok, diffs } = await runCase(name);
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
