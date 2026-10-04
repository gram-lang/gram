import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile, scheduleTimes } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";

/*
 * `--mise-en-place` end to end: the real CLI is started as a process, so what
 * is checked is what a user sees, from argument parsing to the printed times.
 * (`gram print` is only checked on a bad value: on success it opens a browser.)
 */

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

// The retro-planning offset makes the two schedules give different totals.
const TART = `---
title: Tart
---

## Pastry ~{-2d}

Mix @flour{200g}(sifted).

## Assembly

Combine the pastry with @filling{300g}(chopped).
`;

const expected = compile(getAST(TART));
const minutes = (mode: "perSection" | "upfront" | "perSession") =>
	Math.round(scheduleTimes(expected, mode).totalTime);

let dir: string;
let recipe: string;

beforeAll(async () => {
	// Its own directory, so no project config is picked up from the repository.
	dir = await mkdtemp(join(tmpdir(), "gram-cli-mise-"));
	recipe = join(dir, "tart.gram");
	await writeFile(recipe, TART, "utf-8");
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

function gram(...args: string[]) {
	const run = Bun.spawnSync([process.execPath, ENTRY, ...args], { cwd: dir });
	const strip = (b: Uint8Array) =>
		new TextDecoder().decode(b).replace(/\x1b\[[0-9;]*m/g, "");
	return {
		code: run.exitCode,
		out: strip(run.stdout),
		err: strip(run.stderr),
	};
}

/** "48h 5m", "2h", "35m" -> minutes. */
function toMinutes(text: string): number {
	const h = /(\d+)h/.exec(text)?.[1] ?? "0";
	const m = /(\d+)m/.exec(text)?.[1] ?? "0";
	return Number(h) * 60 + Number(m);
}

const viewTotal = (out: string) =>
	toMinutes(/Total: ([^\s│]+(?: \d+m)?)/.exec(out)?.[1] ?? "");

describe("gram view --mise-en-place", () => {
	it("plans right before each section by default", () => {
		const { code, out } = gram("view", recipe);
		expect(code).toBe(0);
		expect(viewTotal(out)).toBe(minutes("perSection"));
	}, 30_000);

	it("follows the chosen schedule, with a space or an equals sign", () => {
		const perSection = gram("view", recipe, "--mise-en-place", "per-section");
		const upfront = gram("view", recipe, "--mise-en-place", "upfront");
		const upfrontEq = gram("view", recipe, "--mise-en-place=upfront");

		expect(viewTotal(perSection.out)).toBe(minutes("perSection"));
		expect(viewTotal(upfront.out)).toBe(minutes("upfront"));
		expect(viewTotal(upfrontEq.out)).toBe(minutes("upfront"));
		// The retro-planning offset is what tells the two apart.
		expect(minutes("upfront")).not.toBe(minutes("perSection"));
	}, 60_000);

	it("accepts per-session, and plans each working day", () => {
		const { code, out } = gram(
			"view",
			recipe,
			"--mise-en-place",
			"per-session",
		);
		expect(code).toBe(0);
		expect(viewTotal(out)).toBe(minutes("perSession"));
	}, 30_000);

	it("keeps preparation and active time the same in all of them", () => {
		const times = (out: string) =>
			/Prep: [^·]+·\s+Active: [^·]+/.exec(out)?.[0].trim();
		const a = gram("view", recipe, "--mise-en-place", "per-section").out;
		const b = gram("view", recipe, "--mise-en-place", "upfront").out;
		expect(times(a)).toBeDefined();
		expect(times(a)).toBe(times(b));
	}, 60_000);
});

describe("gram export --mise-en-place", () => {
	async function exported(...extra: string[]) {
		const target = join(dir, `out-${extra.join("").replace(/\W/g, "")}.md`);
		const run = gram(
			"export",
			recipe,
			"--format",
			"md",
			"-o",
			target,
			...extra,
		);
		expect(run.code).toBe(0);
		const md = await readFile(target, "utf-8");
		return toMinutes(/\*\*Total Time\*\*: (.+)/.exec(md)?.[1] ?? "");
	}

	it("writes the total time of the chosen schedule", async () => {
		expect(await exported()).toBe(minutes("perSection"));
		expect(await exported("--mise-en-place", "upfront")).toBe(
			minutes("upfront"),
		);
	}, 60_000);
});

describe("an unknown --mise-en-place value", () => {
	for (const command of [
		["view", "<recipe>"],
		["export", "<recipe>", "--format", "md"],
		["print", "<recipe>"],
	]) {
		it(`is refused by gram ${command[0]} before doing any work`, () => {
			const args = command.map((a) => (a === "<recipe>" ? recipe : a));
			const { code, err, out } = gram(...args, "--mise-en-place", "nope");
			expect(code).toBe(1);
			expect(`${out}${err}`).toContain('Unknown --mise-en-place value "nope"');
			expect(`${out}${err}`).toContain("per-section, upfront");
		}, 30_000);
	}
});
