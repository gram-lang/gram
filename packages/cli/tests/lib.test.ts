import { describe, it, expect, afterEach } from "bun:test";
import { runPipeline, GramCLIError, ExitCode } from "../src/lib";
import { writeTmpFile, cleanupTmpFile, makeDb } from "./helpers";

// Imports from ../src/lib (not ../src/index, which self-executes the CLI on
// import) to pin the public export surface published as @gram-lang/cli's
// main entry — a doc once promised this was importable when it wasn't.
describe("public lib entry", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("runs parse+compile without an ingredient database", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const { compiled, analyzed } = await runPipeline(path);
		expect((compiled as any).shopping_list[0].id).toBe("flour");
		expect(analyzed).toBeNull();
	});

	it("runs the full pipeline when a database is provided", async () => {
		const path = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const db = makeDb({ flour: { density: 0.5 } });
		const { analyzed } = await runPipeline(path, { db });
		expect(analyzed).not.toBeNull();
	});

	it("throws a GramCLIError for a missing file", async () => {
		await expect(runPipeline("/no/such/file.gram")).rejects.toBeInstanceOf(
			GramCLIError,
		);
	});

	it("exports ExitCode alongside GramCLIError for catching pipeline errors", () => {
		expect(ExitCode.Error).toBe(1);
	});
});
