#!/usr/bin/env bun
/**
 * Conformance runner for the scheduler, independent of the Gram pipeline: its
 * inputs are task graphs (`tasks.json`), not recipes, so an implementation of
 * the scheduler alone (a Rust port, say) can be checked against the same files.
 *
 *   cases/layout-*   tasks.json + options.json (optional)  -> schedule.json
 *   cases/project-*  tasks.json + context.json (+ options.json, title.txt)
 *                                                           -> projected.json, runsheet.json
 *
 * Usage:
 *   bun run schedule/run.ts             # verify every case against its goldens
 *   bun run schedule/run.ts --update    # (re)write the goldens
 *   bun run schedule/run.ts project-003 # only the cases whose name contains it
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	layout,
	project,
	runSheet,
	type LayoutOptions,
	type ProjectionContext,
	type TaskGraph,
} from "@gram-lang/scheduler";

const CASES_DIR = join(dirname(fileURLToPath(import.meta.url)), "cases");

const args = process.argv.slice(2);
const update = args.includes("--update");
const onlyFailures = args.includes("--only-failures") || args.includes("-q");
const filters = args.filter((a) => !a.startsWith("-"));

const toJSON = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const readJSON = <T>(path: string, fallback?: T): T =>
	existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : (fallback as T);

function check(
	path: string,
	actual: unknown,
	diffs: string[],
	label: string,
): void {
	const text = toJSON(actual);
	if (update || !existsSync(path)) {
		writeFileSync(path, text);
		return;
	}
	if (readFileSync(path, "utf-8") !== text) {
		diffs.push(`${label} does not match its golden (${path})`);
	}
}

function runCase(name: string): string[] {
	const dir = join(CASES_DIR, name);
	const diffs: string[] = [];
	const graph = readJSON<TaskGraph>(join(dir, "tasks.json"));
	const options = readJSON<LayoutOptions>(join(dir, "options.json"), {});
	if (name.startsWith("layout-")) {
		check(join(dir, "schedule.json"), layout(graph, options), diffs, "layout");
	} else if (name.startsWith("project-")) {
		const context = readJSON<ProjectionContext>(join(dir, "context.json"));
		const titlePath = join(dir, "title.txt");
		const title = existsSync(titlePath)
			? readFileSync(titlePath, "utf-8").trim()
			: undefined;
		const plan = project(
			[{ graph, options, ...(title !== undefined && { title }) }],
			context,
		);
		check(join(dir, "projected.json"), plan, diffs, "projection");
		check(join(dir, "runsheet.json"), runSheet(plan), diffs, "run sheet");
	} else {
		diffs.push(`unknown kind of case "${name}" (expected layout-* or project-*)`);
	}
	return diffs;
}

const names = readdirSync(CASES_DIR)
	.filter((n) => filters.length === 0 || filters.some((f) => n.includes(f)))
	.sort();

let failed = 0;
for (const name of names) {
	const diffs = runCase(name);
	if (diffs.length > 0) {
		failed++;
		console.log(`  FAIL  ${name}`);
		for (const d of diffs) console.log(`        ${d}`);
	} else if (!onlyFailures) {
		console.log(`  ok    ${name}`);
	}
}
console.log(
	`\n${update ? `${names.length} cases updated` : `${names.length - failed}/${names.length} cases checked`}.`,
);
process.exit(failed > 0 ? 1 : 0);
