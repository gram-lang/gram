import { describe, it, expect, afterEach } from "bun:test";
import { loadDb } from "../src/core/db";
import { writeTmpFile, cleanupTmpFile } from "./helpers";
import type { GramConfig } from "../src/types";

const config = {} as GramConfig;

// Regression test for the audit (2026-07-22, cli finding B-3): an invalid
// ingredient database entry logged its warning via `log.warn`
// (@clack/prompts), which writes to stdout — corrupting machine-readable
// output the moment `gram build | jq` (or any piped command) hit a database
// with even one bad entry. Diagnostics from `core/` must always go to
// stderr; deciding how to *display* them is a `commands/`-layer concern.
describe("loadDb", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmpDb(content: string): Promise<string> {
		const path = await writeTmpFile(content, ".yaml");
		paths.push(path);
		return path;
	}

	it("never writes to stdout when a database entry is rejected", async () => {
		const dbPath = await tmpDb("broken: {physical: {density: not-a-number}}\n");

		const stdoutWrite = process.stdout.write.bind(process.stdout);
		const stderrWrite = process.stderr.write.bind(process.stderr);
		const stdoutCalls: unknown[] = [];
		const stderrCalls: unknown[] = [];
		process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
			stdoutCalls.push(chunk);
			return true;
		}) as typeof process.stdout.write;
		process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
			stderrCalls.push(chunk);
			return true;
		}) as typeof process.stderr.write;

		try {
			const data = await loadDb(config, dbPath);
			expect(data).toEqual({});
		} finally {
			process.stdout.write = stdoutWrite;
			process.stderr.write = stderrWrite;
		}

		expect(stdoutCalls).toEqual([]);
		expect(stderrCalls.length).toBeGreaterThan(0);
		expect(String(stderrCalls[0])).toContain(
			"Ignoring 1 invalid ingredient(s)",
		);
	});

	it("returns the valid entries alongside rejecting the invalid one", async () => {
		const dbPath = await tmpDb(
			"flour:\n  name: Flour\nbroken: {physical: {density: not-a-number}}\n",
		);

		const stderrWrite = process.stderr.write.bind(process.stderr);
		process.stderr.write = (() => true) as typeof process.stderr.write;
		let data: Record<string, unknown> | null;
		try {
			data = await loadDb(config, dbPath);
		} finally {
			process.stderr.write = stderrWrite;
		}

		expect(data).toEqual({ flour: { name: "Flour" } });
	});
});
