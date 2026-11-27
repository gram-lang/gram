import { afterAll, describe, expect, it } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readFile,
	rm,
	stat,
	utimes,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IngredientData } from "@gram-lang/analyzer";
import { checkFiles, FIX_MAX_PASSES } from "../src/services/checker";

/*
 * `gram check --fix`: the preferred fixes applied in place, pass after pass
 * until nothing is left to fix, within the recipe file alone.
 */

const ENTRY = join(import.meta.dir, "..", "src", "index.ts");
const TITLE = "---\ntitle: T\n---\n\n## A\n\n";

// Two passes: `&flour` becomes `@&flour` (REFERENCE_TO_INGREDIENT), and the
// blank line MERGED_STEP_LINE inserts at the same point waits for the next.
const CHAIN = `${TITLE}Mix @flour{1} ->&d\n&flour again.\n\nServe &d.\n`;
const CHAIN_FIXED = `${TITLE}Mix @flour{1} ->&d\n\n@&flour again.\n\nServe &d.\n`;

const DURATION = `${TITLE}Boil ~{15%min}.\n`;
const DURATION_FIXED = `${TITLE}Boil ~{15 min}.\n`;

const dirs: string[] = [];
afterAll(async () => {
	for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

/** A fresh project (`.gram/`, an optional config) holding `files`. */
async function project(
	files: Record<string, string>,
	config?: string,
): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), "gram-check-fix-"));
	dirs.push(dir);
	await mkdir(join(dir, ".gram"), { recursive: true });
	if (config) await writeFile(join(dir, ".gram", "config.yaml"), config);
	for (const [name, text] of Object.entries(files))
		await writeFile(join(dir, name), text, "utf-8");
	return dir;
}

const read = (dir: string, name: string) => readFile(join(dir, name), "utf-8");

const codes = (r: Awaited<ReturnType<typeof checkFiles>>) =>
	r.diagnostics.map((d) => d.code);

describe("checkFiles with fix", () => {
	it("applies fixes pass after pass, until none is left", async () => {
		const dir = await project({ "r.gram": CHAIN });
		const file = join(dir, "r.gram");
		const result = await checkFiles([file], { fix: true });
		expect(await read(dir, "r.gram")).toBe(CHAIN_FIXED);
		expect(result.fixed?.get(file)).toBe(2);
		expect(codes(result)).not.toContain("REFERENCE_TO_INGREDIENT");
		expect(codes(result)).not.toContain("MERGED_STEP_LINE");
	});

	it("stops at the cap of passes, and reports what the next pass would fix", async () => {
		expect(FIX_MAX_PASSES).toBe(5);
		const dir = await project({ "r.gram": CHAIN });
		const file = join(dir, "r.gram");
		const result = await checkFiles([file], { fix: true, maxFixPasses: 1 });
		expect(await read(dir, "r.gram")).toBe(
			`${TITLE}Mix @flour{1} ->&d\n@&flour again.\n\nServe &d.\n`,
		);
		expect(result.fixed?.get(file)).toBe(1);
		expect(codes(result)).toContain("MERGED_STEP_LINE");
	});

	it("never touches a @use dependency, nor applies a fix meant for one", async () => {
		// `base.gram` warns (INVALID_DURATION, reported on the `@use` line);
		// `other.gram` keeps `&rest` private, so MODULE_EXPORT_NOT_FOUND offers
		// to re-export it: a fix that edits `other.gram`, never applied to the
		// recipe's text.
		const base = "## Dough ->&dough\n\nRest ~{15%min}.\n";
		const other = "## Rest\n\nMix @flour{1}. ->&rest\n";
		const recipe = (d: string) =>
			`---\ntitle: T\n---\n\n@use "./base.gram" as &dough\n\n@use "./other.gram" as { &rest }\n\n## A\n\nBake &dough and &rest ~{${d}}.\n`;
		const dir = await project({
			"base.gram": base,
			"other.gram": other,
			"r.gram": recipe("20%min"),
		});
		const file = join(dir, "r.gram");
		const result = await checkFiles([file], { fix: true });
		expect(await read(dir, "base.gram")).toBe(base);
		expect(await read(dir, "other.gram")).toBe(other);
		expect(await read(dir, "r.gram")).toBe(recipe("20 min"));
		expect(result.fixed?.get(file)).toBe(1);
		const reExport = result.diagnostics.find(
			(d) => d.code === "MODULE_EXPORT_NOT_FOUND",
		);
		expect(reExport?.fixes?.[0]?.edits[0]?.uri).toBe(join(dir, "other.gram"));
		const fromBase = result.diagnostics.find(
			(d) => d.code === "INVALID_DURATION",
		);
		expect(fromBase?.related?.[0]?.file).toBe(join(dir, "base.gram"));
	});

	it("leaves a code turned off in .gram/config.yaml", async () => {
		const dir = await project(
			{ "r.gram": DURATION },
			"lint:\n  rules:\n    INVALID_DURATION: off\n",
		);
		const file = join(dir, "r.gram");
		const result = await checkFiles([file], { fix: true });
		expect(await read(dir, "r.gram")).toBe(DURATION);
		expect(result.fixed?.get(file)).toBe(0);
	});

	it("leaves a code named by a // gram-ignore", async () => {
		const text = `${TITLE}// gram-ignore INVALID_DURATION\nBoil ~{15%min}.\n`;
		const dir = await project({ "r.gram": text });
		const file = join(dir, "r.gram");
		const result = await checkFiles([file], { fix: true });
		expect(await read(dir, "r.gram")).toBe(text);
		expect(result.fixed?.get(file)).toBe(0);
	});

	it("never renames an unknown ingredient, even with one closest name", async () => {
		const text = `${TITLE}Mix @flur{100 g}.\n`;
		const db = { flour: { name: "Flour" } as unknown as IngredientData };
		const dir = await project({ "r.gram": text });
		const file = join(dir, "r.gram");
		const result = await checkFiles([file], { fix: true, db });
		expect(await read(dir, "r.gram")).toBe(text);
		expect(result.fixed?.get(file)).toBe(0);
		expect(codes(result)).toContain("UNKNOWN_INGREDIENT");
	});

	it("does not write a file it did not change", async () => {
		const dir = await project({ "r.gram": `${TITLE}Mix @a{1}.\n` });
		const file = join(dir, "r.gram");
		const past = new Date("2020-01-01T00:00:00Z");
		await utimes(file, past, past);
		const result = await checkFiles([file], { fix: true });
		expect(result.fixed?.get(file)).toBe(0);
		expect((await stat(file)).mtime.getTime()).toBe(past.getTime());
	});

	it("reports no fixed count without fix", async () => {
		const dir = await project({ "r.gram": DURATION });
		const result = await checkFiles([join(dir, "r.gram")]);
		expect(result.fixed).toBeUndefined();
		expect(await read(dir, "r.gram")).toBe(DURATION);
	});
});

function gram(cwd: string, ...args: string[]) {
	const run = Bun.spawnSync([process.execPath, ENTRY, ...args], { cwd });
	const text = (b: Uint8Array) =>
		new TextDecoder().decode(b).replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
	return { code: run.exitCode, out: text(run.stdout), err: text(run.stderr) };
}

describe("gram check --fix", () => {
	it("ends on a summary of the fixes applied and the diagnostics left", async () => {
		const dir = await project({
			"r.gram": CHAIN,
			"w.gram": `${TITLE}Wait ~timer{10}.\n`,
		});
		const { out } = gram(dir, "check", "--fix", "--skip-db");
		expect(out).toContain("2 fixes applied, 1 remaining.");
	});

	it("gives each file its fixed count in JSON, with only the diagnostics left, and stderr stays quiet", async () => {
		const dir = await project({ "r.gram": CHAIN, "d.gram": DURATION });
		// Named, not globbed: a glob lists files in the directory's own order.
		const { code, out, err } = gram(
			dir,
			"check",
			"r.gram",
			"d.gram",
			"--fix",
			"--skip-db",
			"--format",
			"json",
		);
		const report = JSON.parse(out);
		expect(report.version).toBe(1);
		expect(
			report.files.map((f: { file: string; fixed: number }) => [
				f.file,
				f.fixed,
			]),
		).toEqual([
			["r.gram", 2],
			["d.gram", 1],
		]);
		expect(report.diagnostics).toEqual([]);
		expect(err).toBe("");
		expect(code).toBe(0);
		expect(await read(dir, "d.gram")).toBe(DURATION_FIXED);
	});

	it("exits 0 under --strict once everything is fixed, 1 when a warning is left", async () => {
		const fixed = await project({ "d.gram": DURATION });
		expect(gram(fixed, "check", "--fix", "--strict", "--skip-db").code).toBe(0);
		expect(gram(fixed, "check", "--strict", "--skip-db").code).toBe(0);

		const left = await project({
			"d.gram": `${TITLE}Boil ~{15%min}, wait ~timer{10}.\n`,
		});
		expect(gram(left, "check", "--fix", "--strict", "--skip-db").code).toBe(1);
		expect(await read(left, "d.gram")).toContain("~{15 min}");
	});
});
