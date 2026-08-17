import { describe, it, expect } from "bun:test";
import { getAST, type SectionAST } from "@gram-lang/parser";
import { computeExports } from "../src/exports";
import {
	buildRenameTable,
	applyRename,
	checkRenameCollisions,
} from "../src/rename";

// Phase C.2 of the module-imports RFC: the rename table + AST rewrite that
// namespaces a module's intermediates before splicing, and the slugify-based
// collision check that's the actual safety net (no separator survives
// slugify, so picking one "unlikely" doesn't protect anything by itself).

describe("buildRenameTable + applyRename", () => {
	it("renames a bound default export directly to the local binding name", () => {
		const ast = getAST("## Pastry ->&paton\n\nMix @flour{200g}.\n");
		const { sections, exports } = computeExports(ast);
		const table = buildRenameTable(sections, exports, [
			{ exported: "default", local: "pate" },
		]);

		expect(table.get("paton")).toBe("pate");

		const renamed = applyRename(sections, table);
		expect(renamed[0]?.intermediateDecl?.name).toBe("pate");
	});

	it("prefixes a step-level private intermediate with the binding's local name", () => {
		const ast = getAST(
			"## Pastry ->&paton\n\nMix @flour{200g} ->&mixed, then rest 10min.\n",
		);
		const { sections, exports } = computeExports(ast);
		const table = buildRenameTable(sections, exports, [
			{ exported: "default", local: "pate" },
		]);

		expect(table.get("mixed")).toBe("pate$mixed");

		const renamed = applyRename(sections, table);
		const stepDecl = renamed[0]?.children
			.flatMap((c) => ("children" in c ? c.children : []))
			.find((c) => c.type === "IntermediateDecl");
		expect((stepDecl as { name?: string } | undefined)?.name).toBe(
			"pate$mixed",
		);
	});

	it("prefixes an unbound public export when only one of several is bound", () => {
		const ast = getAST(
			"## Blancs ->&blancs\n\nSeparate.\n\n## Jaunes ->&jaunes\n\nSeparate.\n",
		);
		const { sections, exports } = computeExports(ast);
		const table = buildRenameTable(sections, exports, [
			{ exported: "blancs", local: "blancs" },
		]);

		expect(table.get("blancs")).toBe("blancs");
		expect(table.get("jaunes")).toBe("blancs$jaunes");
	});

	it("renames a reference to the bound intermediate inside the module's own body", () => {
		const ast = getAST(
			"## Pastry ->&paton\n\nMix @flour{200g}.\n\n## Bake\n\nUse &paton{250g}.\n",
		);
		const { sections, exports } = computeExports(ast);
		const table = buildRenameTable(sections, exports, [
			{ exported: "default", local: "pate" },
		]);
		const renamed = applyRename(sections, table);

		const bakeStep = renamed[1]?.children.find((c) => c.type === "Step");
		const ref = (
			bakeStep as SectionAST["children"][number] & {
				children: { type: string; name?: string }[];
			}
		)?.children.find((c) => c.type === "Reference");
		expect(ref?.name).toBe("pate");
	});

	it("renames a relative-quantity variable target", () => {
		const ast = getAST(
			"## Dough ->&dough\n\nMix @flour{200g}.\n\n@water{70% &dough}.\n",
		);
		const { sections, exports } = computeExports(ast);
		const table = buildRenameTable(sections, exports, [
			{ exported: "default", local: "pate" },
		]);
		const renamed = applyRename(sections, table);

		const step = renamed[0]?.children[1];
		const water = (
			step as SectionAST["children"][number] & {
				children: {
					type: string;
					quantity?: { type: string; target?: string };
				}[];
			}
		)?.children.find((c) => c.type === "Ingredient");
		expect(water?.quantity?.target).toBe("pate");
	});

	it("does not mutate the input sections (pure)", () => {
		const ast = getAST("## Pastry ->&paton\n\nMix @flour{200g}.\n");
		const { sections, exports } = computeExports(ast);
		const table = buildRenameTable(sections, exports, [
			{ exported: "default", local: "pate" },
		]);
		applyRename(sections, table);

		expect(sections[0]?.intermediateDecl?.name).toBe("paton");
	});
});

describe("checkRenameCollisions", () => {
	it("detects a collision even when the separator differs (post-slugify)", () => {
		const claimed = new Set(["pate-paton"]);
		const collisions = checkRenameCollisions(["pate$paton"], claimed);
		expect(collisions).toEqual(["pate$paton"]);
	});

	it("claims ids that don't collide", () => {
		const claimed = new Set<string>();
		const collisions = checkRenameCollisions(["pate$paton", "pate"], claimed);
		expect(collisions).toEqual([]);
		expect(claimed.has("pate-paton")).toBe(true);
		expect(claimed.has("pate")).toBe(true);
	});
});
