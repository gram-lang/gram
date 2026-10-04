import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * `gram plan` end to end: the real CLI is started as a process, so what is
 * checked is what a user sees, from the flags to the sheet and the calendar.
 */

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");

const BREAD = `---
title: Country bread
---

## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350ml} and knead ~{20min}.

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Shape &dough{850g} and bake for ~{30min}.
`;

let dir: string;
let recipe: string;

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), "gram-cli-plan-"));
	recipe = join(dir, "bread.gram");
	await writeFile(recipe, BREAD, "utf-8");
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
	"bread.gram",
	"--serve",
	"2026-10-11 13:00",
	"--tz",
	"Europe/Paris",
	"--now",
	"2026-10-01T09:00:00Z",
];

describe("gram plan", () => {
	it("prints the sheet in the language of the project, backward from the service", () => {
		const { code, out } = gram(...PLAN, "--available", "08:00-22:00");
		expect(code).toBe(0);
		expect(out).toContain("Production sheet — Country bread");
		expect(out).toContain("Served Sunday, October 11 at 13:00");
		expect(out).toContain("Saturday, October 10 · D-1");
		expect(out).toMatch(/around 12:30\s+Bake — Bake/);
	});

	it("stretches the rest to keep the kneading out of the night, and says so", () => {
		const { out } = gram(...PLAN, "--available", "08:00-22:00");
		expect(out).toMatch(/around 21:\d\d\s+Dough — Mix/);
		expect(out).toContain("Rest stretched from 8h to 14h 30m");
	});

	it("starts in the night when nothing says otherwise, and does not stretch", () => {
		const { out } = gram(...PLAN);
		expect(out).toMatch(/around 04:\d\d\s+Dough — Mix/);
		expect(out).not.toContain("stretched");
	});

	it("reads availability by weekday: Saturday ending at 20:00 leaves no way to fit the kneading", () => {
		// The kneading has to end the evening before, and the longest rest (16 h)
		// cannot reach back from 12:30 on Sunday to 20:00 on Saturday.
		const { out } = gram(
			...PLAN,
			"--available",
			"08:00-22:00",
			"--available",
			"sat=09:00-20:00",
		);
		expect(out).toContain("falls when you are not available");
		const open = gram(
			...PLAN,
			"--available",
			"08:00-22:00",
			"--available",
			"sat=09:00-23:00",
		).out;
		expect(open).not.toContain("falls when you are not available");
	});

	it("reports what it could not fix", () => {
		const { out } = gram(
			...PLAN,
			"--available",
			"08:00-22:00",
			"--available",
			"2026-10-10=none",
			"--available",
			"2026-10-11=none",
		);
		expect(out).toContain("To fix");
	});

	it("writes markdown, html or json", () => {
		expect(gram(...PLAN, "--format", "md").out).toContain(
			"# Production sheet — Country bread",
		);
		expect(gram(...PLAN, "--format", "html").out).toContain(
			'<section class="gram-run-sheet">',
		);
		const json = JSON.parse(gram(...PLAN, "--format", "json").out);
		expect(Object.keys(json)).toEqual(["plan", "runSheet"]);
		expect(json.plan.serveAt).toBe("2026-10-11T13:00");
	});

	it("follows --rests", () => {
		const shortest = gram(...PLAN, "--rests", "shortest").out;
		const longest = gram(...PLAN, "--rests", "longest").out;
		expect(shortest).toMatch(/\(8h, until around 12:30\)/);
		expect(longest).toMatch(/\(16h, until around Sun 12:30\)/);
	});

	it("writes a calendar, in UTC, stamped from --now, with the status on stderr", async () => {
		const path = join(dir, "bread.ics");
		const { code, out, err } = gram(...PLAN, "--format", "json", "--ics", path);
		expect(code).toBe(0);
		expect(() => JSON.parse(out)).not.toThrow();
		expect(err).toContain("Calendar written to");
		const ics = await readFile(path, "utf-8");
		expect(ics).toContain("BEGIN:VCALENDAR");
		expect(ics).toContain("DTSTAMP:20261001T090000Z");
		expect(ics).toContain("DTEND:20261011T110000Z");
		expect(ics).toContain("BEGIN:VALARM");
	});

	it("warns when the first task should already have started", () => {
		const { out } = gram(
			...PLAN.slice(0, -1),
			"2026-10-11T09:00",
			"--available",
			"00:00-24:00",
		);
		expect(out).toContain("The first task should have started");
	});

	it("refuses a bad serving time, zone, availability or format", () => {
		for (const bad of [
			["--serve", "sunday"],
			["--tz", "Mars/Olympus"],
			["--available", "8-22"],
			["--format", "pdf"],
			["--rests", "slowest"],
			["--mise-en-place", "later"],
		]) {
			const args = [...PLAN];
			const at = args.indexOf(bad[0]!);
			if (at === -1) args.push(...bad);
			else args[at + 1] = bad[1]!;
			const { code } = gram(...args);
			expect(code).toBe(1);
		}
	});

	it("needs --serve", () => {
		expect(gram("plan", "bread.gram").code).not.toBe(0);
	});
});

describe("--rests on the other commands", () => {
	it("changes the total of gram view, like --mise-en-place does", () => {
		const total = (rests: string) =>
			/Total: ([^\s│]+(?: \d+m)?)/.exec(
				gram("view", "bread.gram", "--rests", rests).out,
			)?.[1];
		expect(total("shortest")).not.toBe(total("longest"));
	});

	it("is refused when unknown", () => {
		expect(gram("view", "bread.gram", "--rests", "slowest").code).toBe(1);
		expect(gram("export", "bread.gram", "--rests", "slowest").code).toBe(1);
		expect(gram("print", "bread.gram", "--rests", "slowest").code).toBe(1);
	});

	it("is accepted by gram export", () => {
		const out = gram(
			"export",
			"bread.gram",
			"--format",
			"md",
			"--rests",
			"longest",
		);
		expect(out.code).toBe(0);
	});
});

describe("the timezone setting", () => {
	let project: string;

	const inProject = (...args: string[]) => {
		const run = Bun.spawnSync([process.execPath, ENTRY, ...args], {
			cwd: project,
		});
		const strip = (b: Uint8Array) =>
			new TextDecoder().decode(b).replace(/\x1b\[[0-9;]*m/g, "");
		return {
			code: run.exitCode,
			out: strip(run.stdout),
			err: strip(run.stderr),
		};
	};
	const withSetting = async (value: string) => {
		await mkdir(join(project, ".gram"), { recursive: true });
		await writeFile(
			join(project, ".gram", "config.yaml"),
			`timezone: ${value}\n`,
			"utf-8",
		);
	};
	const plan = (...extra: string[]) =>
		inProject(
			"plan",
			"bread.gram",
			"--serve",
			"2026-10-11 13:00",
			"--now",
			"2026-10-01T09:00:00Z",
			"--format",
			"json",
			...extra,
		);
	const serveInstant = (out: string) => {
		const plan = JSON.parse(out).plan;
		return plan.recipes[0].blocks.at(-1).end as string;
	};

	beforeAll(async () => {
		project = await mkdtemp(join(tmpdir(), "gram-cli-plan-tz-"));
		await writeFile(join(project, "bread.gram"), BREAD, "utf-8");
	});

	afterAll(async () => {
		await rm(project, { recursive: true, force: true });
	});

	it("is the zone the serving time is read in", async () => {
		await withSetting("America/New_York");
		expect(serveInstant(plan().out)).toBe("2026-10-11T17:00:00Z");
	});

	it("loses to --tz", async () => {
		await withSetting("America/New_York");
		expect(serveInstant(plan("--tz", "Europe/Paris").out)).toBe(
			"2026-10-11T11:00:00Z",
		);
	});

	it("is an error for gram plan only when it is not a zone, naming the setting", async () => {
		await withSetting("Mars/Olympus");
		const { code, err, out } = plan();
		expect(code).toBe(1);
		expect(`${err}${out}`).toContain("Mars/Olympus");
		expect(`${err}${out}`).toContain("timezone");
	});

	it("does not stop the other commands, whatever it holds", async () => {
		await withSetting("Mars/Olympus");
		expect(inProject("view", "bread.gram").code).toBe(0);
		expect(inProject("build", "bread.gram").code).toBe(0);
	});

	it("still lets --tz rescue a bad setting", async () => {
		await withSetting("Mars/Olympus");
		expect(plan("--tz", "Europe/Paris").code).toBe(0);
	});
});
