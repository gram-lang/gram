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
		expect(out).toContain("Work plan — Country bread");
		expect(out).toContain("For Sunday, October 11 at 13:00");
		expect(out).toContain("SATURDAY, OCTOBER 10");
		expect(out).toMatch(/SUN 11\s+▮ 12:30 – 13:00\s+Bake/);
	});

	it("stretches the rest to keep the kneading out of the night, and says so", () => {
		const { out } = gram(...PLAN, "--available", "08:00-22:00");
		expect(out).toMatch(/SAT 10\s+▮ 21:\d\d – 22:\d\d\s+Dough/);
		expect(out).toContain("Dough : Rise extended to 14h 30m");
	});

	it("starts in the night when nothing says otherwise, and does not stretch", () => {
		const { out } = gram(...PLAN);
		expect(out).toMatch(/SUN 11\s+▮ 04:\d\d – 04:\d\d\s+Dough/);
		expect(out).not.toContain("extended");
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
			"# Work plan — Country bread",
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
		expect(shortest).toMatch(/Dough : Rise 8h to 16h/);
		expect(longest).toMatch(/Dough : Rise 16h \(8h to 16h\)/);
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

	it("takes its kit from --mise-en-place in text, Markdown, HTML and the calendar", async () => {
		// The glaze is asked for at the second section: by section it is taken out
		// on the day of the glaze, upfront on the first visit.
		await writeFile(
			join(dir, "tart.gram"),
			"---\ntitle: Tart\n---\n\n## Pastry ->&pastry ~{-1d}\n\n[Mix] Mix @flour{200g}.\n\n## Glaze\n\n[Cover] Cover &pastry with @jam{80g}.\n",
			"utf-8",
		);
		const args = (mode: string, ...more: string[]) => [
			"plan",
			"tart.gram",
			"--serve",
			"2026-10-11 13:00",
			"--tz",
			"Europe/Paris",
			"--now",
			"2026-10-01T09:00:00Z",
			"--mise-en-place",
			mode,
			...more,
		];
		const firstVisit = (out: string, marker: RegExp) =>
			(out.split(marker)[1] ?? "").split(/Before leaving|En partant/)[0] ?? "";
		for (const [format, marker] of [
			["text", /To take out/],
			["md", /\*\*To take out\*\*/],
			["html", /work-plan-kit/],
		] as const) {
			const by = gram(...args("per-section", "--format", format)).out;
			const up = gram(...args("upfront", "--format", format)).out;
			expect(firstVisit(by, marker)).not.toContain("jam");
			expect(firstVisit(up, marker)).toContain("jam");
		}
		const ics = join(dir, "tart.ics");
		gram(...args("upfront", "--ics", ics));
		expect(await Bun.file(ics).text()).toContain("jam 80 g");
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
});

describe("gram plan without a serving time", () => {
	const RELATIVE = [
		"plan",
		"bread.gram",
		"--tz",
		"Europe/Paris",
		"--available",
		"08:00-22:00",
		"--now",
		"2026-10-10T10:00",
	];

	it("writes the days before the service, with no date, and the earliest it could be ready", () => {
		const { code, out } = gram(...RELATIVE);
		expect(code).toBe(0);
		expect(out).toContain("Work plan — Country bread");
		expect(out).toMatch(/Day D\s+▮ ~ \d+m/);
		expect(out).not.toContain("For Sunday");
		expect(out).toContain("Ready as early as");
		expect(out).toContain("if you start now.");
	});

	it("gives the earliest in JSON too, next to the sheet", () => {
		const json = JSON.parse(gram(...RELATIVE, "--format", "json").out);
		expect(json.plan).toBeUndefined();
		expect(json.runSheet.mode).toBe("relative");
		expect(json.earliest.serveAt).toMatch(/^2026-10-/);
	});

	it("needs --serve for a calendar", () => {
		const { code, out, err } = gram(...RELATIVE, "--ics", join(dir, "x.ics"));
		expect(code).toBe(1);
		expect(`${out}${err}`).toContain("--ics needs --serve");
	});
});

describe("gram plan --find", () => {
	const FIND = [
		"plan",
		"bread.gram",
		"--tz",
		"Europe/Paris",
		"--available",
		"08:00-22:00",
		"--now",
		"2026-10-10T10:00",
		"--find",
		"2026-10-10/2026-10-12",
	];

	it("lists the serving times that work, then those that don't, with why", () => {
		const { code, out } = gram(...FIND);
		expect(code).toBe(0);
		expect(out).toMatch(
			/Sunday, October 11 20:00 — start .* · \d visits? to the kitchen/,
		);
		expect(out).toContain("not possible. You would have to start");
	});

	it("tries the meal times it is given", () => {
		const { out } = gram(...FIND, "--meal-times", "19:00");
		expect(out).toContain("October 11 19:00");
		expect(out).not.toContain("12:30");
		expect(out).not.toContain("20:00");
	});

	it("takes the meal times from the project setting", async () => {
		const project = await mkdtemp(join(tmpdir(), "gram-cli-meals-"));
		try {
			await mkdir(join(project, ".gram"), { recursive: true });
			await writeFile(
				join(project, ".gram", "config.yaml"),
				"mealTimes:\n  - '18:30'\n",
			);
			await writeFile(join(project, "bread.gram"), BREAD);
			const run = Bun.spawnSync([process.execPath, ENTRY, ...FIND], {
				cwd: project,
			});
			const out = new TextDecoder().decode(run.stdout);
			expect(out).toContain("18:30");
			expect(out).not.toContain("12:30");
		} finally {
			await rm(project, { recursive: true, force: true });
		}
	});

	it("writes JSON candidates and rejections", () => {
		const json = JSON.parse(gram(...FIND, "--format", "json").out);
		expect(json.candidates.length).toBeGreaterThan(0);
		expect(json.rejected.length).toBeGreaterThan(0);
		expect(json.rejected[0].reasons.length).toBeGreaterThan(0);
		expect(json.candidates[0].plan).toBeUndefined();
	});

	it("refuses a bad range, a bad meal time, --serve and html", () => {
		for (const args of [
			["--find", "tomorrow"],
			["--find", "2026-10-12/2026-10-10"],
			["--meal-times", "noon"],
			["--serve", "2026-10-11 13:00"],
			["--format", "html"],
		]) {
			expect(gram(...FIND, ...args).code).toBe(1);
		}
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

describe("the work plan with the recipe, in export and print", () => {
	const SERVE = [
		"--serve",
		"2026-10-11 13:00",
		"--tz",
		"Europe/Paris",
		"--available",
		"08:00-22:00",
		"--now",
		"2026-10-01T09:00:00Z",
	];

	it("gram view reads the recipe at any time: no hour, no day, no plan", () => {
		const { out } = gram("view", "bread.gram", "--no-pager");
		expect(out).not.toContain("around");
		expect(out).not.toContain("Served");
		expect(out).not.toContain("Work plan");
	});

	it("gram export writes the recipe alone, or the work plan after it with --with-sheet", async () => {
		const path = join(dir, "annotated.md");
		const a = gram("export", "bread.gram", "--format", "md", "-o", path);
		expect(a.code).toBe(0);
		const alone = await readFile(path, "utf-8");
		expect(alone).not.toContain("Work plan");
		expect(alone).not.toContain("around");

		const b = gram(
			"export",
			"bread.gram",
			"--format",
			"md",
			"-o",
			path,
			"--with-sheet",
			...SERVE,
		);
		expect(b.code).toBe(0);
		const withSheet = await readFile(path, "utf-8");
		expect(withSheet).toContain("## Work plan — Country bread");
		expect(withSheet).toContain("- [ ] flour 500 g");
		// The recipe part is the same as without the plan.
		expect(withSheet.startsWith(alone.trimEnd())).toBe(true);
	});

	it("gram export writes the print document with the plan's styles", async () => {
		const path = join(dir, "annotated.html");
		const { code } = gram(
			"export",
			"bread.gram",
			"--format",
			"html",
			"-o",
			path,
			"--with-sheet",
			...SERVE,
		);
		expect(code).toBe(0);
		const html = await readFile(path, "utf-8");
		expect(html).toContain('<section class="gram-run-sheet">');
		expect(html).toContain(".work-plan-day");
	});

	it("gram print writes it too (without opening a browser)", async () => {
		const { code, out } = gram(
			"print",
			"bread.gram",
			"--no-open",
			"--with-sheet",
			...SERVE,
		);
		expect(code).toBe(0);
		const path = /(\/\S*gram_print_\d+\.html)/.exec(out)![1]!;
		const html = await readFile(path, "utf-8");
		expect(html).toContain("Work plan — Country bread");
	});

	it("refuses the plan flags without --with-sheet, and --with-sheet without --serve", () => {
		for (const args of [
			["export", "bread.gram", "--format", "md", "--available", "08:00-22:00"],
			["export", "bread.gram", "--format", "md", "--serve", "2026-10-11 13:00"],
			["export", "bread.gram", "--format", "md", "--with-sheet"],
			["print", "bread.gram", "--no-open", "--with-sheet"],
			["print", "bread.gram", "--no-open", "--serve", "2026-10-11 13:00"],
		]) {
			expect(gram(...args).code).toBe(1);
		}
	});

	it("takes the time zone from the project setting too", async () => {
		const project = await mkdtemp(join(tmpdir(), "gram-cli-annotated-tz-"));
		try {
			await mkdir(join(project, ".gram"), { recursive: true });
			await writeFile(
				join(project, ".gram", "config.yaml"),
				"timezone: Asia/Tokyo\n",
			);
			await writeFile(join(project, "bread.gram"), BREAD);
			const run = Bun.spawnSync(
				[
					process.execPath,
					ENTRY,
					"export",
					"bread.gram",
					"--format",
					"md",
					"-o",
					join(project, "out.md"),
					"--with-sheet",
					"--serve",
					"2026-10-11 13:00",
				],
				{ cwd: project },
			);
			expect(run.exitCode).toBe(0);
			const md = await readFile(join(project, "out.md"), "utf-8");
			// Served 13:00 on the wall clock of Tokyo, whatever this machine's zone.
			expect(md).toContain("For Sunday, October 11 at 13:00");
		} finally {
			await rm(project, { recursive: true, force: true });
		}
	});
});

describe("a recipe that imports bases, planned for real", () => {
	const BASE = (title: string, body: string) =>
		`---\ntitle: ${title}\n---\n\n## ${title} ->&${title.toLowerCase()}\n\n${body}\n`;
	const SPONGE = BASE(
		"Sponge",
		"[Whisk] Whisk @eggs{3} with @sugar{60g}.\n\n[Bake] Bake at ^{180C} ~_{12min}.",
	);
	const GLAZE = BASE(
		"Glaze",
		"[Heat] Heat @cream{100g} for ~{5min}.\n\n[Cool] Cool ~_{90min}.",
	);
	const CAKE = `---
title: Layer cake
portions: 6
---

@use "./bases/sponge.gram" as &sponge ~{-1d}
@use "./bases/glaze.gram" as &glaze

## Assemble

[Layer] Layer &sponge and cover it with &glaze ~{10min}.
`;
	let project: string;

	beforeAll(async () => {
		project = await mkdtemp(join(tmpdir(), "gram-cli-use-plan-"));
		await mkdir(join(project, ".gram"), { recursive: true });
		await mkdir(join(project, "bases"), { recursive: true });
		await writeFile(join(project, ".gram", "config.yaml"), "language: en\n");
		await writeFile(join(project, "bases", "sponge.gram"), SPONGE);
		await writeFile(join(project, "bases", "glaze.gram"), GLAZE);
		await writeFile(join(project, "cake.gram"), CAKE);
	});

	afterAll(async () => {
		await rm(project, { recursive: true, force: true });
	});

	const planIn = (...extra: string[]) => {
		const run = Bun.spawnSync(
			[
				process.execPath,
				ENTRY,
				"plan",
				"cake.gram",
				"--serve",
				"2026-10-17 20:00",
				"--tz",
				"Europe/Paris",
				"--now",
				"2026-10-10T10:00",
				...extra,
			],
			{ cwd: project },
		);
		return {
			code: run.exitCode,
			out: new TextDecoder().decode(run.stdout),
		};
	};

	it("takes an imported base into the visits and names its file", () => {
		const { code, out } = planIn();
		expect(code).toBe(0);
		expect(out).toContain("Sponge (sponge.gram, steps 1 to 2)");
		expect(out).toContain("Glaze (glaze.gram, steps 1 to 2)");
		// The sponge is made a day before it is used.
		expect(out).toMatch(/Sponge, made \w+day/);
	});

	it("lists a base kept in stock, and plans no visit for it", () => {
		const { code, out } = planIn("--stock", "./bases/glaze.gram");
		expect(code).toBe(0);
		expect(out).toContain("glaze, in stock");
		expect(out).not.toContain("glaze.gram, steps");
		expect(out).toContain("Sponge (sponge.gram, steps 1 to 2)");
	});
});
