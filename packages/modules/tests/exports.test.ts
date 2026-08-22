import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { computeExports } from "../src/exports";

// Phase A.4 of the module-imports RFC: only section-level `->&` are public,
// and the default export is deterministic.

describe("computeExports", () => {
	it("exports the single ->& section as both its own name and 'default'", () => {
		const ast = getAST("## Pastry ->&pate\n\nMix @flour{200g}.\n");
		const { exports } = computeExports(ast);

		expect(exports.get("pate")?.sectionIndex).toBe(0);
		expect(exports.get("default")?.sectionIndex).toBe(0);
		expect(exports.get("default")?.name).toBe("pate");
	});

	it("does not export a step-level intermediate", () => {
		const ast = getAST("## Pastry\n\nMix @flour{200g} ->&mixed, then rest.\n");
		const { exports } = computeExports(ast);

		expect(exports.has("mixed")).toBe(false);
	});

	it("wraps a module with no section headers into a single default section", () => {
		const ast = getAST("Mix @flour{200g}.\n");
		const { sections, exports } = computeExports(ast);

		expect(sections).toHaveLength(1);
		expect(exports.get("default")?.sectionIndex).toBe(0);
	});

	it("defaults to the last section when the module has several named exports", () => {
		const ast = getAST(
			"## Blancs ->&blancs\n\nSeparate.\n\n## Jaunes ->&jaunes\n\nSeparate.\n",
		);
		const { exports } = computeExports(ast);

		expect(exports.get("blancs")?.sectionIndex).toBe(0);
		expect(exports.get("jaunes")?.sectionIndex).toBe(1);
		expect(exports.get("default")?.sectionIndex).toBe(1);
		expect(exports.get("default")?.name).toBe("jaunes");
	});

	it("does not re-export a module's own imported binding", () => {
		// `sauce.gram` uses a bouillon but never declares its own ->&bouillon
		// section, so it must not transitively expose it.
		const ast = getAST(
			'@use "./base.gram" as &bouillon\n\n## Sauce ->&sauce\n\nReduce &bouillon{500ml}.\n',
		);
		const { exports } = computeExports(ast);

		expect(exports.has("bouillon")).toBe(false);
		expect(exports.has("sauce")).toBe(true);
	});

	it("returns no default export for a completely empty module", () => {
		const ast = getAST("");
		const { sections, exports } = computeExports(ast);

		expect(sections).toEqual([]);
		expect(exports.has("default")).toBe(false);
	});
});
