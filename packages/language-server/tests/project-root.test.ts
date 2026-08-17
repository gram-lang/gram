import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectRootSync } from "../src/utils/project-root";

describe("findProjectRootSync", () => {
	const dirs: string[] = [];

	afterEach(async () => {
		while (dirs.length > 0)
			await rm(dirs.pop()!, { recursive: true, force: true });
	});

	it("finds a .gram directory in a parent", async () => {
		const root = await mkdtemp(join(tmpdir(), "gram-projroot-"));
		dirs.push(root);
		await mkdir(join(root, ".gram"));
		const nested = join(root, "recipes", "desserts");
		await mkdir(nested, { recursive: true });

		expect(findProjectRootSync(nested)).toBe(root);
	});

	it("finds a .gram directory in the start directory itself", async () => {
		const root = await mkdtemp(join(tmpdir(), "gram-projroot-"));
		dirs.push(root);
		await mkdir(join(root, ".gram"));

		expect(findProjectRootSync(root)).toBe(root);
	});

	it("falls back to the start directory when no .gram is found", async () => {
		const dir = await mkdtemp(join(tmpdir(), "gram-projroot-"));
		dirs.push(dir);

		expect(findProjectRootSync(dir)).toBe(dir);
	});
});
