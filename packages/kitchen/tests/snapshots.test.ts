import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Compiler Snapshots", () => {
	const fixturesDir = join(import.meta.dir, "fixtures", "valid");
	const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".gram"));

	for (const file of files) {
		it(`should compile ${file} correctly`, () => {
			const input = readFileSync(join(fixturesDir, file), "utf-8");
			const ast = getAST(input);
			// `generator` embeds the package version: keep it out of the snapshot so
			// a release doesn't invalidate every one.
			const { generator, ...result } = compile(ast);
			expect(generator).toMatch(/^@gram-lang\/kitchen@\d+\.\d+\.\d+/);
			expect(result).toMatchSnapshot();
		});
	}
});
