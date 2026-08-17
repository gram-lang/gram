import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createLspModuleHost } from "../src/module-host";

describe("createLspModuleHost", () => {
	const dirs: string[] = [];

	afterEach(async () => {
		while (dirs.length > 0)
			await rm(dirs.pop()!, { recursive: true, force: true });
	});

	async function project(files: Record<string, string>): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "gram-lsphost-"));
		dirs.push(dir);
		for (const [name, content] of Object.entries(files)) {
			const filePath = join(dir, name);
			await mkdir(dirname(filePath), { recursive: true });
			await writeFile(filePath, content, "utf-8");
		}
		return dir;
	}

	it("resolves a relative specifier against the importer's own file: uri", async () => {
		const dir = await project({ "base.gram": "## Base\n" });
		const host = createLspModuleHost(dir, { get: () => undefined });
		const fromUri = pathToFileURL(join(dir, "tarte.gram")).toString();
		expect(host.resolve("./base.gram", fromUri)).toBe(
			pathToFileURL(join(dir, "base.gram")).toString(),
		);
	});

	it("resolves @/ against the project root", async () => {
		const dir = await project({ "base.gram": "## Base\n" });
		const host = createLspModuleHost(dir, { get: () => undefined });
		const fromUri = pathToFileURL(
			join(dir, "recipes", "tarte.gram"),
		).toString();
		expect(host.resolve("@/base.gram", fromUri)).toBe(
			pathToFileURL(join(dir, "base.gram")).toString(),
		);
	});

	it("resolves a declared @alias/ path", async () => {
		const dir = await project({ "shared/bases/base.gram": "## Base\n" });
		const host = createLspModuleHost(
			dir,
			{ get: () => undefined },
			{ bases: "./shared/bases" },
		);
		const fromUri = pathToFileURL(join(dir, "tarte.gram")).toString();
		expect(host.resolve("@bases/base.gram", fromUri)).toBe(
			pathToFileURL(join(dir, "shared", "bases", "base.gram")).toString(),
		);
	});

	it("rejects an undeclared @alias/", () => {
		const dir = "/tmp/does-not-matter";
		const host = createLspModuleHost(dir, { get: () => undefined });
		const fromUri = pathToFileURL(join(dir, "tarte.gram")).toString();
		expect(() => host.resolve("@bases/base.gram", fromUri)).toThrow();
	});

	it("confines a resolved path to the project root", async () => {
		const dir = await project({ "tarte.gram": '@use "../../etc/passwd"\n' });
		const host = createLspModuleHost(dir, { get: () => undefined });
		const fromUri = pathToFileURL(join(dir, "tarte.gram")).toString();
		expect(() => host.resolve("../../etc/passwd", fromUri)).toThrow();
	});

	it("prefers an open editor buffer over the file on disk", async () => {
		const dir = await project({ "base.gram": "## Base (on disk)\n" });
		const uri = pathToFileURL(join(dir, "base.gram")).toString();
		const openDocs = new Map([[uri, { getText: () => "## Base (unsaved)\n" }]]);
		const host = createLspModuleHost(dir, openDocs);
		expect(await host.read(uri)).toBe("## Base (unsaved)\n");
	});

	it("falls back to disk when the file isn't open", async () => {
		const dir = await project({ "base.gram": "## Base (on disk)\n" });
		const uri = pathToFileURL(join(dir, "base.gram")).toString();
		const host = createLspModuleHost(dir, { get: () => undefined });
		expect(await host.read(uri)).toBe("## Base (on disk)\n");
	});
});
