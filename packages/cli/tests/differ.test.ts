import { describe, it, expect, afterEach } from "bun:test";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { computeDiff } from "../src/services/differ";
import { writeTmpFile, cleanupTmpFile } from "./helpers";

function run(cmd: string, args: string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd, stdio: "ignore" });
		child.on("error", reject);
		child.on("close", (code) =>
			code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
		);
	});
}

describe("computeDiff — two explicit files", () => {
	const paths: string[] = [];

	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("reports a quantity change between two files", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const b = await tmp("## Prep\n[Mix] Add @flour{400g}.\n");
		const { result, label } = await computeDiff({ fileA: a, fileB: b });
		expect(result.hasChanges).toBe(true);
		const flour = result.ingredients.find((i) => i.id === "flour");
		expect(flour?.change).toBe("changed");
		expect(flour?.fromQty).toBe(200);
		expect(flour?.toQty).toBe(400);
		expect(label).toContain("→");
	});

	it("reports an added ingredient", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const b = await tmp("## Prep\n[Mix] Add @flour{200g} and @sugar{50g}.\n");
		const { result } = await computeDiff({ fileA: a, fileB: b });
		const sugar = result.ingredients.find((i) => i.id === "sugar");
		expect(sugar?.change).toBe("added");
	});

	it("reports a removed ingredient", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g} and @sugar{50g}.\n");
		const b = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const { result } = await computeDiff({ fileA: a, fileB: b });
		const sugar = result.ingredients.find((i) => i.id === "sugar");
		expect(sugar?.change).toBe("removed");
	});

	it("reports no changes for two identical files", async () => {
		const a = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const b = await tmp("## Prep\n[Mix] Add @flour{200g}.\n");
		const { result } = await computeDiff({ fileA: a, fileB: b });
		expect(result.hasChanges).toBe(false);
		expect(result.ingredients).toHaveLength(0);
	});

	it("detects a title change", async () => {
		const a = await tmp(
			'---\ntitle: "Old Name"\n---\n## P\n[Mix] Add @flour{1g}.\n',
		);
		const b = await tmp(
			'---\ntitle: "New Name"\n---\n## P\n[Mix] Add @flour{1g}.\n',
		);
		const { result } = await computeDiff({ fileA: a, fileB: b });
		expect(result.titleChanged).toBe(true);
		expect(result.fromTitle).toBe("Old Name");
		expect(result.toTitle).toBe("New Name");
	});
});

describe("computeDiff — git mode", () => {
	let repoDir: string;
	let filePath: string;

	afterEach(async () => {
		if (repoDir) await rm(repoDir, { recursive: true, force: true });
	});

	async function initRepo(initialContent: string): Promise<void> {
		repoDir = await mkdtemp(join(tmpdir(), "gram-differ-git-"));
		await run("git", ["init", "-q"], repoDir);
		await run("git", ["config", "user.email", "test@test.com"], repoDir);
		await run("git", ["config", "user.name", "Test"], repoDir);
		filePath = join(repoDir, "recipe.gram");
		await writeFile(filePath, initialContent, "utf-8");
		await run("git", ["add", "recipe.gram"], repoDir);
		await run("git", ["commit", "-q", "-m", "init"], repoDir);
	}

	it("diffs the working tree against HEAD by default", async () => {
		await initRepo("## Prep\n[Mix] Add @flour{200g}.\n");
		await writeFile(filePath, "## Prep\n[Mix] Add @flour{400g}.\n", "utf-8");
		const { result, label } = await computeDiff({ fileA: filePath });
		const flour = result.ingredients.find((i) => i.id === "flour");
		expect(flour?.fromQty).toBe(200);
		expect(flour?.toQty).toBe(400);
		expect(label).toContain("HEAD");
	});

	it("diffs the working tree against an explicit ref", async () => {
		await initRepo("## Prep\n[Mix] Add @flour{200g}.\n");
		await run("git", ["tag", "v1"], repoDir);
		await writeFile(filePath, "## Prep\n[Mix] Add @flour{400g}.\n", "utf-8");
		await run("git", ["add", "recipe.gram"], repoDir);
		await run("git", ["commit", "-q", "-m", "second"], repoDir);
		await writeFile(filePath, "## Prep\n[Mix] Add @flour{600g}.\n", "utf-8");
		const { result } = await computeDiff({ fileA: filePath, ref: "v1" });
		const flour = result.ingredients.find((i) => i.id === "flour");
		expect(flour?.fromQty).toBe(200);
		expect(flour?.toQty).toBe(600);
	});

	it("throws a clear error when not inside a git repository", async () => {
		const dir = await mkdtemp(join(tmpdir(), "gram-differ-nogit-"));
		repoDir = dir;
		const path = join(dir, "recipe.gram");
		await writeFile(path, "## Prep\n[Mix] Add @flour{200g}.\n", "utf-8");
		await expect(computeDiff({ fileA: path })).rejects.toThrow(
			/not inside a git repository/i,
		);
	});

	it("throws a clear error when the ref doesn't exist", async () => {
		await initRepo("## Prep\n[Mix] Add @flour{200g}.\n");
		await expect(
			computeDiff({ fileA: filePath, ref: "nonexistent-ref" }),
		).rejects.toThrow(/Cannot read/);
	});
});
