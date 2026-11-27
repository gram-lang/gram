import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveGlob } from "../src/core/glob";

// Enough files, written in a scrambled order, that the directory's own order
// (a hash on ext4, creation order elsewhere) is never sorted by chance.
const NAMES = Array.from(
	{ length: 40 },
	(_, i) => `r${String(i).padStart(2, "0")}.gram`,
);
const SCRAMBLED = NAMES.map((n, i) => NAMES[(i * 17) % NAMES.length]!);

let dir: string;
const cwd = process.cwd();

beforeAll(async () => {
	dir = await realpath(await mkdtemp(join(tmpdir(), "gram-glob-")));
	await mkdir(join(dir, ".gram"));
	await mkdir(join(dir, "sub"));
	for (const name of SCRAMBLED) await writeFile(join(dir, name), "Mix.\n");
	await writeFile(join(dir, "sub", "a.gram"), "Mix.\n");
	process.chdir(dir);
});

afterAll(async () => {
	process.chdir(cwd);
	await rm(dir, { recursive: true, force: true });
});

describe("resolveGlob", () => {
	it("lists a glob's matches sorted by path, the same on every filesystem", async () => {
		const files = await resolveGlob(["**/*.gram"]);
		const expected = [
			...NAMES.map((n) => join(dir, n)),
			join(dir, "sub", "a.gram"),
		];
		expect(files).toEqual(expected);
	});

	it("keeps the order of the patterns, and a file named twice at its first place", async () => {
		const files = await resolveGlob(["r39.gram", "sub/*.gram", "r*.gram"]);
		expect(files[0]).toBe(join(dir, "r39.gram"));
		expect(files[1]).toBe(join(dir, "sub", "a.gram"));
		expect(files.slice(2)).toEqual(NAMES.slice(0, 39).map((n) => join(dir, n)));
	});
});
