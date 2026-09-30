import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * `--stock ./bases/pate.gram` is resolved from the directory the command is
 * typed in (a path tab-completed in a shell), not from the recipe. Run from
 * anywhere else, it matches no `@use`: the command has to say so on stderr
 * rather than carry on as if the flag had worked. The real CLI is started as
 * a process, as in the `--mise-en-place` tests. (`cook` and `print` are left
 * out: one is a terminal UI, the other opens a browser.)
 */

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

const BASE = `---
title: Pate
---

## Pate ->&pate

Mix @flour{200g} and @butter{100g}.
`;

const TART = `---
title: Tarte
---

@use "./bases/pate.gram" as &pate

## Garnish

Bake &pate with @apples{3}.
`;

let project: string;
let elsewhere: string;

beforeAll(async () => {
	project = await mkdtemp(join(tmpdir(), "gram-cli-stock-"));
	elsewhere = join(project, "elsewhere");
	await mkdir(join(project, "bases"), { recursive: true });
	await mkdir(elsewhere, { recursive: true });
	await writeFile(join(project, "bases", "pate.gram"), BASE, "utf-8");
	await writeFile(join(project, "tarte.gram"), TART, "utf-8");
});

afterAll(async () => {
	await rm(project, { recursive: true, force: true });
});

function gram(cwd: string, ...args: string[]) {
	const run = Bun.spawnSync([process.execPath, ENTRY, ...args], { cwd });
	const strip = (b: Uint8Array) =>
		new TextDecoder().decode(b).replace(/\x1b\[[0-9;]*m/g, "");
	return { code: run.exitCode, out: strip(run.stdout), err: strip(run.stderr) };
}

// Each command, with what it needs besides the recipe and `--stock`.
const COMMANDS: Array<[string, (recipe: string) => string[]]> = [
	["view", (recipe) => ["view", recipe]],
	["check", (recipe) => ["check", recipe]],
	["scale", (recipe) => ["scale", recipe, "--scale", "2"]],
	[
		"export",
		(recipe) => [
			"export",
			recipe,
			"--format",
			"md",
			"-o",
			join(project, "out.md"),
		],
	],
];

describe("--stock that matches nothing", () => {
	for (const [name, args] of COMMANDS) {
		it(`is reported by gram ${name} when run from another directory`, () => {
			const { err } = gram(
				elsewhere,
				...args("../tarte.gram"),
				"--stock",
				"./bases/pate.gram",
			);
			expect(err).toContain(`gram ${name}: --stock entry never matched a @use`);
			// It says where the entry was looked for, so the cause can be seen.
			expect(err).toContain(join(elsewhere, "bases", "pate.gram"));
			expect(err).toContain(
				"relative path is resolved from the current directory",
			);
		}, 30_000);

		it(`stays silent from the directory the path is relative to (gram ${name})`, () => {
			const { err } = gram(
				project,
				...args("tarte.gram"),
				"--stock",
				"./bases/pate.gram",
			);
			expect(err).not.toContain("never matched");
		}, 30_000);
	}

	it("also reports an entry that names no file at all", () => {
		const { err } = gram(project, "view", "tarte.gram", "--stock", "nope.gram");
		expect(err).toContain("gram view: --stock entry never matched a @use");
		expect(err).toContain(join(project, "nope.gram"));
	}, 30_000);

	it("writes the warning to stderr only, so piped output stays clean", () => {
		const { out } = gram(
			elsewhere,
			"view",
			"../tarte.gram",
			"--stock",
			"./bases/pate.gram",
		);
		expect(out).not.toContain("never matched");
	}, 30_000);
});
