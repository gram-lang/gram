import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GramParseError } from "@gram-lang/parser";
import { runPipeline } from "../src/core/pipeline";
import { checkFiles } from "../src/services/checker";

// Rejected by the parser itself (`err-001` of the conformance corpus).
const BROKEN = "## Section\n@ <@parent\n";

describe("a syntax error in the recipe file", () => {
	let dir: string | undefined;
	afterEach(async () => {
		if (dir) await rm(dir, { recursive: true, force: true });
		dir = undefined;
	});

	async function write(files: Record<string, string>): Promise<string> {
		dir = await mkdtemp(join(tmpdir(), "gram-parse-"));
		for (const [name, content] of Object.entries(files)) {
			await writeFile(join(dir, name), content, "utf-8");
		}
		return dir;
	}

	it("is thrown by the pipeline instead of giving an empty recipe", async () => {
		const root = await write({ "r.gram": BROKEN });
		const error = await runPipeline(join(root, "r.gram")).catch((e) => e);
		expect(error).toBeInstanceOf(GramParseError);
		expect((error as GramParseError).message).toContain(
			"Did you mean '<@parent'?",
		);
	});

	it("stays a diagnostic when it is in an imported module", async () => {
		const root = await write({
			"r.gram":
				'@use "./base.gram" as &base\n\n## Montage\n\n[Mix] &base{100g}.\n',
			"base.gram": BROKEN,
		});
		const result = await runPipeline(join(root, "r.gram"));
		expect(result.compiled.warnings.map((w) => w.code)).toContain(
			"MODULE_PARSE_ERROR",
		);
	});

	it("is still reported once, on its line, by gram check", async () => {
		const root = await write({ "r.gram": BROKEN });
		const { diagnostics } = await checkFiles([join(root, "r.gram")]);
		const errors = diagnostics.filter((d) => d.level === "error");
		expect(errors).toHaveLength(1);
		expect(errors[0]?.line).toBe(2);
	});
});
