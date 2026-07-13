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

describe("checkFiles — syntax errors", () => {
	// The invalid-composite construct is on line 2 — this pins the diagnostic's
	// `line` to GramParseError.offset (via getAST), not a regex on the message.
	const path = join(tmpdir(), `gram-checker-syntax-test-${Date.now()}.gram`);

	beforeAll(async () => {
		await writeFile(path, "## Section\n@ <@parent\n", "utf-8");
	});

	afterAll(async () => {
		await unlink(path);
	});

	it("resolves the offset of a GramParseError to the correct line number", async () => {
		const result = await checkFiles([path]);
		expect(result.hasErrors).toBe(true);
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics[0]?.line).toBe(2);
	});
});
