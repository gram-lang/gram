import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * `--comments show|hide` end to end: the real CLI is started as a process,
 * so what is checked is what a user sees in the recipe and in the work plan.
 */

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

const CAKE = `---
title: Cake
---

## Cake

[Mix] Mix @flour{100g} // keep it cold
and stir ~{5min}.

// Do not overmix.

[Bake] Bake at ^{200C} for ~{20min}.
`;

let dir: string;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), "gram-cli-comments-"));
	await writeFile(join(dir, "cake.gram"), CAKE, "utf-8");
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

function gram(...args: string[]) {
	const run = Bun.spawnSync([process.execPath, ENTRY, ...args], { cwd: dir });
	const strip = (b: Uint8Array) =>
		new TextDecoder().decode(b).replace(/\x1b\[[0-9;]*m/g, "");
	return { code: run.exitCode, out: strip(run.stdout), err: strip(run.stderr) };
}

const PLAN = [
	"plan",
	"cake.gram",
	"--serve",
	"2026-10-11 13:00",
	"--tz",
	"Europe/Paris",
	"--now",
	"2026-10-01T09:00:00Z",
];

describe("gram plan --comments", () => {
	it("shows the comments in the work plan by default and with show", () => {
		for (const extra of [[], ["--comments", "show"]]) {
			const { code, out } = gram(...PLAN, ...extra);
			expect(code).toBe(0);
			expect(out).toContain("Mix flour (keep it cold) and stir 5 min.");
			expect(out).toContain("(Do not overmix.)");
		}
	});

	it("hides them with hide, in every format", () => {
		for (const format of ["text", "md", "html"]) {
			const { code, out } = gram(
				...PLAN,
				"--comments",
				"hide",
				"--format",
				format,
			);
			expect(code).toBe(0);
			expect(out).not.toContain("keep it cold");
			expect(out).not.toContain("Do not overmix.");
			expect(out).toContain("Bake");
		}
	});

	it("refuses a value that is neither show nor hide", () => {
		const { code, out, err } = gram(...PLAN, "--comments", "some");
		expect(code).toBe(1);
		expect(`${out}${err}`).toContain("comments");
	});
});

describe("gram export --comments", () => {
	it("writes the comments of the recipe, or leaves them out", async () => {
		const shown = join(dir, "shown.md");
		const hidden = join(dir, "hidden.md");
		expect(
			gram("export", "cake.gram", "--format", "md", "-o", shown).code,
		).toBe(0);
		expect(
			gram(
				"export",
				"cake.gram",
				"--format",
				"md",
				"--comments",
				"hide",
				"-o",
				hidden,
			).code,
		).toBe(0);
		const withComments = await readFile(shown, "utf-8");
		const without = await readFile(hidden, "utf-8");
		expect(withComments).toContain("Do not overmix.");
		expect(withComments).toContain("keep it cold");
		expect(without).not.toContain("Do not overmix.");
		expect(without).not.toContain("keep it cold");
		expect(without).toContain("Bake");
	});

	it("leaves them out of the work plan too", async () => {
		const out = join(dir, "sheet.md");
		const run = gram(
			"export",
			"cake.gram",
			"--format",
			"md",
			"--view",
			"work-plan",
			"--serve",
			"2026-10-11 13:00",
			"--tz",
			"Europe/Paris",
			"--comments",
			"hide",
			"-o",
			out,
		);
		expect(run.code).toBe(0);
		const text = await readFile(out, "utf-8");
		expect(text).toContain("Work plan");
		expect(text).not.toContain("Do not overmix.");
		expect(text).not.toContain("keep it cold");
	});
});
