import { describe, it, expect, afterEach } from "bun:test";
import { loadDb } from "../src/core/db";
import { reportRejectedIngredients } from "../src/ui/diagnostics";
import { writeTmpFile, cleanupTmpFile } from "./helpers";
import type { GramConfig } from "../src/types";

const config = {} as GramConfig;

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

	// Regression test for the audit (2026-07-22, cli finding B-3, full
	// recommendation applied in Phase 14): `loadDb` itself must never perform
	// I/O for diagnostics — it returns `rejected` as plain data, and it's up
	// to the caller (via `reportRejectedIngredients`) to decide whether/how
	// to report it. This is what makes `loadDb` safely unit-testable without
	// capturing stdout/stderr, and prevents `core/` from ever reintroducing a
	// stdout-writing dependency like the original `log.warn` bug.
	it("never writes to stdout or stderr itself — rejected entries come back as data", async () => {
		const dbPath = await tmpDb("broken: {physical: {density: not-a-number}}\n");

		const stdoutWrite = process.stdout.write.bind(process.stdout);
		const stderrWrite = process.stderr.write.bind(process.stderr);
		const stdoutCalls: unknown[] = [];
		const stderrCalls: unknown[] = [];
		process.stdout.write = ((chunk: unknown) => {
			stdoutCalls.push(chunk);
			return true;
		}) as typeof process.stdout.write;
		process.stderr.write = ((chunk: unknown) => {
			stderrCalls.push(chunk);
			return true;
		}) as typeof process.stderr.write;

		let result: Awaited<ReturnType<typeof loadDb>>;
		try {
			result = await loadDb(config, dbPath);
		} finally {
			process.stdout.write = stdoutWrite;
			process.stderr.write = stderrWrite;
		}

		expect(stdoutCalls).toEqual([]);
		expect(stderrCalls).toEqual([]);
		expect(result.data).toEqual({});
		expect(result.rejected.map((r) => r.key)).toEqual(["broken"]);
	});

	it("returns the valid entries alongside rejecting the invalid one", async () => {
		const dbPath = await tmpDb(
			"flour:\n  name: Flour\nbroken: {physical: {density: not-a-number}}\n",
		);

		const result = await loadDb(config, dbPath);

		expect(result.data).toEqual({ flour: { name: "Flour" } });
		expect(result.rejected.map((r) => r.key)).toEqual(["broken"]);
	});
});

describe("reportRejectedIngredients", () => {
	it("writes to stderr, never stdout, when there are rejected entries", () => {
		const stdoutWrite = process.stdout.write.bind(process.stdout);
		const stderrWrite = process.stderr.write.bind(process.stderr);
		const stdoutCalls: unknown[] = [];
		const stderrCalls: unknown[] = [];
		process.stdout.write = ((chunk: unknown) => {
			stdoutCalls.push(chunk);
			return true;
		}) as typeof process.stdout.write;
		process.stderr.write = ((chunk: unknown) => {
			stderrCalls.push(chunk);
			return true;
		}) as typeof process.stderr.write;

		try {
			reportRejectedIngredients(
				[{ key: "broken", message: "bad" }],
				"/tmp/db.yaml",
			);
		} finally {
			process.stdout.write = stdoutWrite;
			process.stderr.write = stderrWrite;
		}

		expect(stdoutCalls).toEqual([]);
		expect(stderrCalls.length).toBe(1);
		expect(String(stderrCalls[0])).toContain(
			"Ignoring 1 invalid ingredient(s)",
		);
	});

	it("writes nothing when there are no rejected entries", () => {
		const stderrWrite = process.stderr.write.bind(process.stderr);
		const stderrCalls: unknown[] = [];
		process.stderr.write = ((chunk: unknown) => {
			stderrCalls.push(chunk);
			return true;
		}) as typeof process.stderr.write;

		try {
			reportRejectedIngredients([], "/tmp/db.yaml");
		} finally {
			process.stderr.write = stderrWrite;
		}

		expect(stderrCalls).toEqual([]);
	});
});
