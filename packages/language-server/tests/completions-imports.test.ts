import { describe, it, expect, afterEach } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createMemoryHost } from "@gram-lang/modules";
import {
	matchUseBindingPrefix,
	matchUseSpecifierPrefix,
	provideImportExportCompletions,
	provideImportPathCompletions,
} from "../src/features/completions-imports";
import { provideCompletions } from "../src/features/completions";
import { parseDocument } from "../src/document-state";

describe("matchUseSpecifierPrefix", () => {
	it("matches an empty specifier right after the opening quote", () => {
		expect(matchUseSpecifierPrefix('@use "')).toBe("");
	});

	it("matches a partial specifier", () => {
		expect(matchUseSpecifierPrefix('@use "./bas')).toBe("./bas");
	});

	it("does not match once the closing quote is typed", () => {
		expect(matchUseSpecifierPrefix('@use "./base.gram"')).toBeNull();
	});

	it("does not match outside an @use line", () => {
		expect(matchUseSpecifierPrefix("[Mix] the @flour")).toBeNull();
	});

	it("tolerates leading whitespace before @use", () => {
		expect(matchUseSpecifierPrefix('  @use "./b')).toBe("./b");
	});
});

describe("provideImportPathCompletions", () => {
	const dirs: string[] = [];

	afterEach(async () => {
		while (dirs.length > 0)
			await rm(dirs.pop()!, { recursive: true, force: true });
	});

	async function project(files: Record<string, string>): Promise<string> {
		const dir = await mkdtemp(join(tmpdir(), "gram-lspcomplete-"));
		dirs.push(dir);
		await mkdir(join(dir, ".gram"));
		for (const [name, content] of Object.entries(files)) {
			const filePath = join(dir, name);
			await mkdir(join(filePath, ".."), { recursive: true });
			await writeFile(filePath, content, "utf-8");
		}
		return dir;
	}

	it("offers the starting points when nothing has been typed", async () => {
		const dir = await project({});
		await writeFile(
			join(dir, ".gram", "config.yaml"),
			"paths:\n  bases: ./shared/bases\n",
		);
		const uri = pathToFileURL(join(dir, "tarte.gram")).toString();

		const items = provideImportPathCompletions("", uri);
		const labels = items.map((i) => i.label);
		expect(labels).toContain("./");
		expect(labels).toContain("../");
		expect(labels).toContain("@/");
		expect(labels).toContain("@bases/");
	});

	it("lists .gram files and subdirectories for a relative partial", async () => {
		const dir = await project({
			"base.gram": "## Base\n",
			"desserts/tarte.gram": "## Tarte\n",
			"notes.txt": "not a recipe",
		});
		const uri = pathToFileURL(join(dir, "top.gram")).toString();

		const items = provideImportPathCompletions("./", uri);
		const labels = items.map((i) => i.label);
		expect(labels).toContain("base.gram");
		expect(labels).toContain("desserts/");
		expect(labels).not.toContain("notes.txt");
	});

	it("lists files inside a subdirectory once the partial commits to it", async () => {
		const dir = await project({ "desserts/tarte.gram": "## Tarte\n" });
		const uri = pathToFileURL(join(dir, "top.gram")).toString();

		const items = provideImportPathCompletions("./desserts/", uri);
		expect(items.map((i) => i.label)).toEqual(["tarte.gram"]);
	});

	it("resolves @/ against the project root regardless of the importing file's own directory", async () => {
		const dir = await project({ "base.gram": "## Base\n" });
		const uri = pathToFileURL(
			join(dir, "recipes", "desserts", "top.gram"),
		).toString();

		const items = provideImportPathCompletions("@/", uri);
		expect(items.map((i) => i.label)).toContain("base.gram");
	});

	it("resolves a declared @alias/ path", async () => {
		const dir = await project({ "shared/bases/base.gram": "## Base\n" });
		await writeFile(
			join(dir, ".gram", "config.yaml"),
			"paths:\n  bases: ./shared/bases\n",
		);
		const uri = pathToFileURL(join(dir, "top.gram")).toString();

		const items = provideImportPathCompletions("@bases/", uri);
		expect(items.map((i) => i.label)).toEqual(["base.gram"]);
	});

	it("returns nothing for an undeclared alias instead of throwing", async () => {
		const dir = await project({});
		const uri = pathToFileURL(join(dir, "top.gram")).toString();
		expect(() => provideImportPathCompletions("@nope/", uri)).not.toThrow();
		expect(provideImportPathCompletions("@nope/", uri)).toEqual([]);
	});
});

describe("matchUseBindingPrefix", () => {
	it("matches the unbraced form, which binds the default export", () => {
		expect(matchUseBindingPrefix('@use "./pate.gram" as &')).toEqual({
			specifier: "./pate.gram",
			kind: "default",
		});
		expect(matchUseBindingPrefix('@use "./pate.gram" as &pa')).toEqual({
			specifier: "./pate.gram",
			kind: "default",
		});
	});

	it("matches a named binding, with the exports already written", () => {
		expect(matchUseBindingPrefix('@use "./b.gram" as { &')).toEqual({
			specifier: "./b.gram",
			kind: "named",
			written: [],
		});
		expect(
			matchUseBindingPrefix(
				'@use "./b.gram" as { &blancs, &creme fouettee{} as &creme, &j',
			),
		).toEqual({
			specifier: "./b.gram",
			kind: "named",
			written: ["blancs", "creme fouettee"],
		});
	});

	it("does not match a local name, which is the author's to choose", () => {
		expect(
			matchUseBindingPrefix('@use "./b.gram" as { &blancs as &'),
		).toBeNull();
		expect(
			matchUseBindingPrefix('@use "./b.gram" as { &blancs as '),
		).toBeNull();
	});

	it("does not match before the sigil, after the braces, or outside @use", () => {
		expect(matchUseBindingPrefix('@use "./b.gram" as ')).toBeNull();
		expect(matchUseBindingPrefix('@use "./b.gram" as { &a }')).toBeNull();
		expect(matchUseBindingPrefix('@use "./b.gram" as &a ~{-1h}')).toBeNull();
		expect(matchUseBindingPrefix("[Mix] the &")).toBeNull();
	});
});

describe("provideImportExportCompletions", () => {
	const BASE =
		"## Blancs ->&blancs\n\n[Whip] @egg white{2}.\n\n## Crème ->&creme fouettee{}\n\n[Whip] @cream{20cl}.\n\n## Fin\n\n[Mix] &blancs and &creme fouettee{}.\n";
	const host = createMemoryHost({
		"/bases/meringue.gram": BASE,
		"/bases/pate.gram": "## Pâte ->&pate\n\n[Mix] @flour{200g}.\n",
		"/bases/plain.gram": "## Mix\n\n[Mix] @flour{200g}.\n",
	});
	const uri = "/tarte.gram";

	it("offers the named exports, multi-word ones with their empty braces", () => {
		const items = provideImportExportCompletions(
			{ specifier: "./bases/meringue.gram", kind: "named", written: [] },
			uri,
			host,
		);
		expect(items.map((i) => [i.label, i.insertText, i.detail])).toEqual([
			["blancs", "blancs", "## Blancs"],
			["creme fouettee", "creme fouettee{}", "## Crème"],
		]);
	});

	it("leaves out the exports already bound", () => {
		const items = provideImportExportCompletions(
			{
				specifier: "./bases/meringue.gram",
				kind: "named",
				written: ["blancs"],
			},
			uri,
			host,
		);
		expect(items.map((i) => i.label)).toEqual(["creme fouettee"]);
	});

	it("offers the name of the default export to the unbraced form", () => {
		const items = provideImportExportCompletions(
			{ specifier: "./bases/pate.gram", kind: "default" },
			uri,
			host,
		);
		expect(items.map((i) => i.label)).toEqual(["pate"]);
	});

	it("offers nothing for a default export with no name of its own", () => {
		expect(
			provideImportExportCompletions(
				{ specifier: "./bases/plain.gram", kind: "default" },
				uri,
				host,
			),
		).toEqual([]);
	});

	it("offers nothing for a module that cannot be read, or without a host", () => {
		const slot = {
			specifier: "./missing.gram",
			kind: "named",
			written: [],
		} as const;
		expect(provideImportExportCompletions(slot, uri, host)).toEqual([]);
		expect(
			provideImportExportCompletions(
				{ ...slot, specifier: "./bases/pate.gram" },
				uri,
				undefined,
			),
		).toEqual([]);
	});

	it("answers while the document being typed does not parse", () => {
		const prefix = '@use "./bases/pate.gram" as &';
		const state = parseDocument(`${prefix}\n\n## Tarte\n\n[Use] it.\n`);
		expect(state.ast).toBeNull();
		const items = provideCompletions(state, {}, prefix, uri, false, host);
		expect(items.map((i) => i.label)).toEqual(["pate"]);
	});
});
