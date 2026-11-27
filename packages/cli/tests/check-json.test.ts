import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * `gram check --format json` and the terminal report, from the real CLI
 * started as a process: the report is what a CI or an AI agent reads, so
 * its shape is pinned by a snapshot. Any change to that snapshot that
 * renames, removes or retypes a field is a change of `version`.
 */

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

// A line with `é` and an emoji before `&pâte`: its column counts UTF-16
// code units (the emoji is two), from 1.
const RECIPE = `---
servings: 4
---

@use "./base.gram" as &dough

## Montage

Mélanger 🧈 &pâte et &dough.

Attendre ~{15%min}.
`;

const BASE = "## Dough ->&dough\n\nMix @flour{1 cup 5 tbsp}.\n";

let project: string;

beforeAll(async () => {
	project = await mkdtemp(join(tmpdir(), "gram-check-json-"));
	await mkdir(join(project, ".gram"), { recursive: true });
	await writeFile(join(project, "recipe.gram"), RECIPE, "utf-8");
	await writeFile(join(project, "base.gram"), BASE, "utf-8");
	await writeFile(
		join(project, "hint-only.gram"),
		"---\ntitle: T\n---\n\n## A\n\nMix @dark chocolate, chopped{200 g}.\n",
		"utf-8",
	);
	await mkdir(join(project, "untitled"), { recursive: true });
	await writeFile(join(project, "untitled", "u.gram"), "## A\n\nMix.\n");
	await mkdir(join(project, "untitled", ".gram"), { recursive: true });
	await writeFile(
		join(project, "untitled", ".gram", "config.yaml"),
		"lint:\n  rules:\n    MISSING_TITLE: hint\n",
	);
});

afterAll(async () => {
	await rm(project, { recursive: true, force: true });
});

function gram(...args: string[]) {
	const run = Bun.spawnSync([process.execPath, ENTRY, ...args], {
		cwd: project,
	});
	const text = (b: Uint8Array) =>
		new TextDecoder()
			.decode(b)
			.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
			.replaceAll(project, "<project>");
	return { code: run.exitCode, out: text(run.stdout), err: text(run.stderr) };
}

describe("gram check --format json", () => {
	it("prints the version 1 report, and nothing else, on stdout", () => {
		const { code, out } = gram("check", "recipe.gram", "--format", "json");
		expect(code).toBe(1);
		expect(JSON.parse(out)).toMatchSnapshot();
	});

	it("gives line and col from 1, col in UTF-16 code units", () => {
		const report = JSON.parse(
			gram("check", "recipe.gram", "--format", "json").out,
		);
		const ref = report.diagnostics.find(
			(d: { code: string }) => d.code === "UNDEFINED_REFERENCE",
		);
		// `Mélanger 🧈 ` is 12 UTF-16 code units (the emoji is two).
		expect([ref.line, ref.col, ref.endLine, ref.endCol]).toEqual([
			9, 13, 9, 18,
		]);
		expect(RECIPE.slice(ref.loc.start, ref.loc.end)).toBe("&pâte");
	});

	it("still prints a report when no file matches", () => {
		const { code, out, err } = gram(
			"check",
			"nowhere/**/*.gram",
			"--format",
			"json",
		);
		expect(code).toBe(1);
		expect(JSON.parse(out)).toEqual({ version: 1, files: [], diagnostics: [] });
		expect(err).toContain("No .gram files found");
	});

	it("rejects an unknown format", () => {
		const { code, out, err } = gram("check", "recipe.gram", "--format", "xml");
		expect(code).toBe(1);
		expect(out).toBe("");
		expect(err).toContain('Unknown --format value "xml"');
	});
});

describe("gram check --strict", () => {
	it("never fails on a hint", () => {
		const { code, out } = gram(
			"check",
			"hint-only.gram",
			"--strict",
			"--format",
			"json",
		);
		const codes = JSON.parse(out).diagnostics.map(
			(d: { code: string; severity: string }) => `${d.code}:${d.severity}`,
		);
		expect(codes).toEqual(["SUSPECT_INGREDIENT_NAME:hint"]);
		expect(code).toBe(0);
	});

	it("reads the lint rules of the file's own project", () => {
		const { code, out } = gram(
			"check",
			"untitled/u.gram",
			"--strict",
			"--format",
			"json",
		);
		const [d] = JSON.parse(out).diagnostics;
		expect([d.code, d.severity]).toEqual(["MISSING_TITLE", "hint"]);
		expect(code).toBe(0);
	});
});

describe("gram check, in the terminal", () => {
	it("writes file:line:col, the code, and where a cause in a dependency is", () => {
		const { code, out } = gram("check", "recipe.gram");
		expect(code).toBe(1);
		expect(out).toContain("recipe.gram\n");
		expect(out).toMatch(
			/ 9:13 +✗ Undefined reference '&pâte'.*UNDEFINED_REFERENCE/,
		);
		expect(out).toMatch(/ - {2,}⚠ Recipe is missing a 'title'.*MISSING_TITLE/);
		expect(out).toMatch(/INVALID_UNIT\n +↳ see base\.gram:3:5\n/);
		expect(out).toMatch(/1 error, 4 warnings in 1 file\./);
	});
});
