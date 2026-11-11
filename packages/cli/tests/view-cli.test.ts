import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * `gram view` end to end: the real CLI is started as a process, so what is
 * checked is what a user sees. The recipe is the renderer's `text` format;
 * the colors are the CLI's.
 */

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

const BREAD = `---
title: Country bread
portions: 2
---

## Dough

// Use a strong flour.

[Mix] Mix @flour{500g} with @water{350g} in a #bowl{}, knead ~{20min}. // keep it cold

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Bake for ~{30min}.
`;

const DB = `ingredients:
  flour:
    name: "Flour"
    physical:
      density: 0.59
    nutrition:
      calories: 364
      carbs: 76
      protein: 10
      fat: 1
`;

let dir: string;
let french: string;
const recipe = () => join(dir, "bread.gram");

beforeAll(async () => {
	// Its own directories, so no project config is picked up from the repository.
	dir = await mkdtemp(join(tmpdir(), "gram-cli-view-"));
	await writeFile(recipe(), BREAD, "utf-8");
	await writeFile(join(dir, "ingredients.yaml"), DB, "utf-8");
	french = await mkdtemp(join(tmpdir(), "gram-cli-view-fr-"));
	await mkdir(join(french, ".gram"));
	await writeFile(
		join(french, ".gram", "config.yaml"),
		"language: fr\n",
		"utf-8",
	);
	await writeFile(join(french, "bread.gram"), BREAD, "utf-8");
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
	await rm(french, { recursive: true, force: true });
});

const ANSI = /\x1b\[[0-9;]*m/g;

function gram(cwd: string, ...args: string[]) {
	const run = Bun.spawnSync([process.execPath, ENTRY, ...args], { cwd });
	const decode = (b: Uint8Array) => new TextDecoder().decode(b);
	return {
		code: run.exitCode,
		raw: decode(run.stdout),
		out: decode(run.stdout).replace(ANSI, ""),
		err: decode(run.stderr).replace(ANSI, ""),
	};
}

const view = (...args: string[]) =>
	gram(dir, "view", recipe(), "--no-pager", "--skip-db", ...args);

describe("gram view", () => {
	it("shows the recipe: the box, the shopping list, each section with its numbered steps", () => {
		const { code, out } = view();
		expect(code).toBe(0);
		expect(out).toStartWith("┌─ Country bread ");
		expect(out).toContain(" 2 portions ─┐");
		expect(out).toContain("SHOPPING LIST\n  flour");
		expect(out).toContain("COOKWARE\n  bowl");
		expect(out).toContain("─── Dough ");
		expect(out).toContain("─── Bake ");
		expect(out).toContain(
			" 1. [Mix] Mix flour (500 g) with water (350 g) in a bowl, knead 20 min. [1]",
		);
		// The steps are numbered in each section.
		expect(out).toMatch(/─── Bake .*\n {3}1\. \[Bake\]/);
		expect(out).toContain("NOTES\n  [1] keep it cold");
	}, 30_000);

	it("writes no color codes when the output is piped, unless FORCE_COLOR asks for them", () => {
		expect(view().raw).not.toContain("\x1b");
		const forced = Bun.spawnSync(
			[process.execPath, ENTRY, "view", recipe(), "--no-pager", "--skip-db"],
			{ cwd: dir, env: { ...process.env, FORCE_COLOR: "1" } },
		);
		const colored = new TextDecoder().decode(forced.stdout);
		expect(colored).toContain("\x1b[");
		expect(colored.replace(ANSI, "")).toContain("┌─ Country bread ");
	}, 60_000);

	it("hides the comments with --comments hide", () => {
		const { out } = view("--comments", "hide");
		expect(out).not.toContain("Use a strong flour.");
		expect(out).not.toContain("NOTES");
	}, 30_000);

	it("leaves the quantities out of the steps with --step-quantities hide, or --no-step-qty", () => {
		for (const flag of [["--step-quantities", "hide"], ["--no-step-qty"]]) {
			const { code, out } = view(...(flag as string[]));
			expect(code).toBe(0);
			expect(out).toContain("[Mix] Mix flour with water in a bowl");
			expect(out).toMatch(/• flour +500 g/);
		}
	}, 60_000);

	it("says what a scale did, and scales the quantities", () => {
		const { out } = view("--scale", "2");
		expect(out).toContain("Scaled ×2");
		expect(out).toMatch(/• flour +1000 g/);
		expect(out).toContain("(×2)");
	}, 30_000);

	it("shows the nutrition with a database, and says which ingredients have none", () => {
		const { out } = gram(
			dir,
			"view",
			recipe(),
			"--no-pager",
			"--db",
			join(dir, "ingredients.yaml"),
		);
		expect(out).toContain("NUTRITION INFORMATION");
		expect(out).toContain("Per portion");
		expect(out).toContain(
			"⚠ 1 ingredient missing nutrition data — run `gram db enrich`",
		);
	}, 30_000);

	it("speaks the language of the project", () => {
		const { out } = gram(
			french,
			"view",
			"bread.gram",
			"--no-pager",
			"--skip-db",
		);
		expect(out).toContain(" 2 portions ─┐");
		expect(out).toContain("LISTE DE COURSES");
		expect(out).toContain("MATÉRIEL");
		expect(out).toContain("Temps total : ");
	}, 30_000);

	it("refuses an unknown value for a setting, with no stack", () => {
		const { code, err } = view("--comments", "maybe");
		expect(code).toBe(1);
		expect(err).not.toContain("    at ");
	}, 30_000);

	it("says so when the file does not exist", () => {
		const { code, out, err } = gram(dir, "view", "nope.gram", "--no-pager");
		expect(code).toBe(1);
		expect(`${out}${err}`).toContain("File not found");
		expect(`${out}${err}`).not.toContain("    at ");
	}, 30_000);
});
