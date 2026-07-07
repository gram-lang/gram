import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFiles } from "../src/services/checker";

describe("checkFiles — warning severity", () => {
	// A Timer without a unit raises MISSING_UNIT, a 'warning'-level code —
	// it must not fail the build unless --strict is passed.
	const path = join(tmpdir(), `gram-checker-test-${Date.now()}.gram`);

	beforeAll(async () => {
		await writeFile(path, "## Section\nWait for ~timer{10}.\n", "utf-8");
	});

	afterAll(async () => {
		await unlink(path);
	});

	it('reports a nutritional/estimation warning as level "warning", not "error", by default', async () => {
		const result = await checkFiles([path]);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.level).toBe("warning");
		expect(result.hasErrors).toBe(false);
	});

	it('promotes the same warning to "error" under --strict', async () => {
		const result = await checkFiles([path], { strict: true });
		expect(result.diagnostics[0]?.level).toBe("error");
		expect(result.hasErrors).toBe(true);
	});
});
