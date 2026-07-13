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
import { analyze } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { GramParseError, getAST } from "@gram-lang/parser";

const CASES_DIR = join(dirname(fileURLToPath(import.meta.url)), "cases");

const args = process.argv.slice(2);
const update = args.includes("--update");
const filters = args.filter((a) => a !== "--update");

function toJSON(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
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

	try {
		const ast = getAST(source);

		if (!update && existsSync(errorGoldenPath)) {
			diffs.push(
				"expected a parse error (error.json is present) but parsing succeeded",
			);
		}

		writeOrCompare(join(caseDir, "ast.json"), toJSON(ast), diffs, "ast.json");

		const compiled = compile(ast);
		writeOrCompare(
			join(caseDir, "compiled.json"),
			toJSON(compiled),
			diffs,
			"compiled.json",
		);

		// Empty ingredient database: exercises the deterministic "no data
		// available" path (missing mass, no nutrition) common to every case.
		// A richer, database-backed golden set is a separate future addition.
		const { result: analyzed } = analyze(compiled, {});
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
