import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProjectConfigSync } from "../src/utils/project-config";

const dirs: string[] = [];

afterEach(async () => {
	while (dirs.length > 0)
		await rm(dirs.pop()!, { recursive: true, force: true });
});

/** A project, with `.gram/config.yaml` holding `configYaml` when given. */
async function project(configYaml?: string): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "gram-projectcfg-"));
	dirs.push(dir);
	if (configYaml !== undefined) {
		await mkdir(join(dir, ".gram"));
		await writeFile(join(dir, ".gram", "config.yaml"), configYaml, "utf-8");
	}
	return dir;
}

const read = async (configYaml?: string) =>
	readProjectConfigSync(await project(configYaml));

describe("readProjectConfigSync", () => {
	it("is empty without a config file, or with one that does not parse", async () => {
		expect(await read()).toEqual({});
		expect(await read("{{ not yaml")).toEqual({});
		expect(await read("paths: [this is not a map\n")).toEqual({});
		expect(await read("just a string\n")).toEqual({});
	});

	it("reads every field from one file", async () => {
		expect(
			await read(
				[
					"paths:",
					"  bases: ./shared/bases",
					"timezone: Europe/Paris",
					"availability: 08:00-22:00",
					'mealTimes: ["12:00", "19:30"]',
					"language: fr",
				].join("\n"),
			),
		).toEqual({
			paths: { bases: "./shared/bases" },
			timeZone: "Europe/Paris",
			availability: { daily: [{ start: "08:00", end: "22:00" }] },
			mealTimes: ["12:00", "19:30"],
		});
	});

	it("leaves out a field that does not read, without hiding the others", async () => {
		expect(
			await read(
				"timezone: Mars/Olympus\navailability: 8-22\nmealTimes: [noon]\npaths:\n  a: ./a\n",
			),
		).toEqual({ paths: { a: "./a" } });
	});

	describe("paths", () => {
		it("drops the aliases that are not strings", async () => {
			expect(
				(await read("paths:\n  bases: ./shared/bases\n  bad: 42\n")).paths,
			).toEqual({ bases: "./shared/bases" });
		});

		it("is absent without a paths: key", async () => {
			expect((await read("language: fr\n")).paths).toBeUndefined();
		});
	});

	describe("timezone", () => {
		it("is absent without one, or with a zone that does not exist", async () => {
			expect((await read("paths:\n  a: ./a\n")).timeZone).toBeUndefined();
			expect((await read("timezone: Mars/Olympus\n")).timeZone).toBeUndefined();
		});
	});

	describe("availability", () => {
		it("reads one entry or a list of them, in the syntax of --available", async () => {
			expect(
				(await read("availability:\n  - 09:00-21:00\n  - sun=none\n"))
					.availability,
			).toEqual({
				daily: [{ start: "09:00", end: "21:00" }],
				weekdays: { sun: [] },
			});
		});

		it("is absent without the setting, or with one that does not parse", async () => {
			expect(
				(await read("timezone: Europe/Paris\n")).availability,
			).toBeUndefined();
			expect((await read("availability: 8-22\n")).availability).toBeUndefined();
			expect((await read("availability: 8\n")).availability).toBeUndefined();
			expect((await read('availability: ""\n')).availability).toBeUndefined();
		});
	});

	describe("mealTimes", () => {
		it("reads them as the CLI does, padding the hour", async () => {
			expect((await read('mealTimes: ["9:30", "19:30"]\n')).mealTimes).toEqual([
				"09:30",
				"19:30",
			]);
		});

		it("is absent without them, or with a time it cannot read", async () => {
			expect((await read('mealTimes: ["noon"]\n')).mealTimes).toBeUndefined();
			expect((await read("mealTimes: 12:00\n")).mealTimes).toBeUndefined();
			expect((await read("mealTimes: []\n")).mealTimes).toBeUndefined();
		});
	});
});
