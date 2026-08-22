import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPathsConfigSync } from "../src/utils/module-paths-config";

describe("readPathsConfigSync", () => {
	const dirs: string[] = [];

	afterEach(async () => {
		while (dirs.length > 0)
			await rm(dirs.pop()!, { recursive: true, force: true });
	});

	async function project(configYaml?: string): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "gram-pathscfg-"));
		dirs.push(dir);
		if (configYaml !== undefined) {
			await mkdir(join(dir, ".gram"));
			await writeFile(join(dir, ".gram", "config.yaml"), configYaml, "utf-8");
		}
		return dir;
	}

	it("reads a declared paths: map", async () => {
		const dir = await project("paths:\n  bases: ./shared/bases\n");
		expect(readPathsConfigSync(dir)).toEqual({ bases: "./shared/bases" });
	});

	it("returns undefined when there is no config file", async () => {
		const dir = await project();
		expect(readPathsConfigSync(dir)).toBeUndefined();
	});

	it("returns undefined when the config has no paths: key", async () => {
		const dir = await project("language: fr\n");
		expect(readPathsConfigSync(dir)).toBeUndefined();
	});

	it("drops non-string values instead of throwing", async () => {
		const dir = await project("paths:\n  bases: ./shared/bases\n  bad: 42\n");
		expect(readPathsConfigSync(dir)).toEqual({ bases: "./shared/bases" });
	});

	it("returns undefined for malformed YAML instead of throwing", async () => {
		const dir = await project("paths: [this is not a map\n");
		expect(() => readPathsConfigSync(dir)).not.toThrow();
	});
});
