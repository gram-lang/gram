import { describe, it, expect } from "bun:test";
import { loadModuleGraph } from "../src/graph";
import { createFakeHost } from "./fake-host";

// Phase B of the module-imports RFC (.notes/plan-ajout-imports-recettes.md):
// loadModuleGraph does one DFS pass over the whole import graph, so these
// cover its structural guarantees — cache dedup, leaves-first topological
// order, cycle/depth/specifier diagnostics — independent of any real
// filesystem, via a tiny in-memory ModuleHost (fake-host.ts).

describe("loadModuleGraph", () => {
	it("loads a single module with no imports", async () => {
		const host = createFakeHost({
			"/recipe.gram": "## Section\n\nMix @flour{200g}.\n",
		});
		const graph = await loadModuleGraph("/recipe.gram", host);

		expect(graph.diagnostics).toEqual([]);
		expect([...graph.modules.keys()]).toEqual(["/recipe.gram"]);
		expect(graph.order).toEqual(["/recipe.gram"]);
	});

	it("resolves a chain and orders it leaves-first", async () => {
		const host = createFakeHost({
			"/a.gram": '@use "./b.gram" as &b\n\n## S\n\n[Use] &b{100g}.\n',
			"/b.gram": '@use "./c.gram" as &c\n\n## S ->&b\n\n[Use] &c{50g}.\n',
			"/c.gram": "## S ->&c\n\nMix @flour{50g}.\n",
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics).toEqual([]);
		expect(graph.order).toEqual(["/c.gram", "/b.gram", "/a.gram"]);
	});

	it("loads a diamond dependency only once", async () => {
		const host = createFakeHost({
			"/a.gram":
				'@use "./b.gram" as &b\n@use "./c.gram" as &c\n\n## S\n\n[Use] &b{1} &c{1}.\n',
			"/b.gram": '@use "./d.gram" as &d\n\n## S ->&b\n\n[Use] &d{1}.\n',
			"/c.gram": '@use "./d.gram" as &d\n\n## S ->&c\n\n[Use] &d{1}.\n',
			"/d.gram": "## S ->&d\n\nMix @flour{50g}.\n",
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics).toEqual([]);
		expect(graph.modules.size).toBe(4);
		// /d.gram appears once in `order` despite being reached via both /b and /c.
		expect(graph.order.filter((u) => u === "/d.gram")).toHaveLength(1);
		expect(graph.order.indexOf("/d.gram")).toBeLessThan(
			graph.order.indexOf("/a.gram"),
		);
	});

	it("reports MODULE_NOT_FOUND for a missing file and still returns the rest of the graph", async () => {
		const host = createFakeHost({
			"/a.gram": '@use "./missing.gram" as &m\n\n## S\n\n[Use] &m{1}.\n',
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics.map((d) => d.code)).toEqual(["MODULE_NOT_FOUND"]);
		expect(graph.modules.has("/a.gram")).toBe(true);
	});

	it("reports MODULE_PARSE_ERROR for a module with a syntax error", async () => {
		const host = createFakeHost({
			"/a.gram": '@use "./bad.gram" as &b\n\n## S\n\n[Use] &b{1}.\n',
			"/bad.gram": "## S\n@ <@parent\n",
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics.map((d) => d.code)).toEqual([
			"MODULE_PARSE_ERROR",
		]);
	});

	it("reports MODULE_CYCLE for a direct self-import (A -> A)", async () => {
		const host = createFakeHost({
			"/a.gram": '@use "./a.gram" as &a\n\n## S\n\n[Use] &a{1}.\n',
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics.map((d) => d.code)).toEqual(["MODULE_CYCLE"]);
	});

	it("reports MODULE_CYCLE for an indirect cycle (A -> B -> A) with the full chain", async () => {
		const host = createFakeHost({
			"/a.gram": '@use "./b.gram" as &b\n\n## S\n\n[Use] &b{1}.\n',
			"/b.gram": '@use "./a.gram" as &a\n\n## S ->&b\n\n[Use] &a{1}.\n',
		});
		const graph = await loadModuleGraph("/a.gram", host);

		const cycle = graph.diagnostics.find((d) => d.code === "MODULE_CYCLE");
		expect(cycle?.message).toContain("/a.gram");
		expect(cycle?.message).toContain("/b.gram");
	});

	it("rejects an absolute path specifier", async () => {
		const host = createFakeHost({
			"/a.gram": '@use "/etc/passwd" as &x\n\n## S\n\n[Use] &x{1}.\n',
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics.map((d) => d.code)).toEqual([
			"MODULE_SPECIFIER_INVALID",
		]);
	});

	it("accepts an '@/' project-root specifier (resolution is host-specific)", async () => {
		const host = createFakeHost({
			"/a.gram":
				'@use "@/bases/pate.gram" as &pate\n\n## S\n\n[Use] &pate{1}.\n',
			"/@/bases/pate.gram": "## Base\n\n[Mix] the @flour{200g}.\n",
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics).toEqual([]);
		expect([...graph.modules.keys()]).toContain("/@/bases/pate.gram");
	});

	it("accepts an '@alias/' specifier the same way", async () => {
		const host = createFakeHost({
			"/a.gram":
				'@use "@bases/pate.gram" as &pate\n\n## S\n\n[Use] &pate{1}.\n',
			"/@bases/pate.gram": "## Base\n\n[Mix] the @flour{200g}.\n",
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics).toEqual([]);
	});

	it("rejects an http(s):// specifier as an unsupported scheme", async () => {
		const host = createFakeHost({
			"/a.gram":
				'@use "https://example.com/pate.gram" as &x\n\n## S\n\n[Use] &x{1}.\n',
		});
		const graph = await loadModuleGraph("/a.gram", host);

		expect(graph.diagnostics.map((d) => d.code)).toEqual([
			"MODULE_SCHEME_UNSUPPORTED",
		]);
	});

	it("respects a custom maxDepth and reports MODULE_DEPTH_EXCEEDED", async () => {
		const host = createFakeHost({
			"/a.gram": '@use "./b.gram" as &b\n\n## S\n\n[Use] &b{1}.\n',
			"/b.gram": '@use "./c.gram" as &c\n\n## S ->&b\n\n[Use] &c{1}.\n',
			"/c.gram": "## S ->&c\n\nMix @flour{50g}.\n",
		});
		const graph = await loadModuleGraph("/a.gram", host, { maxDepth: 1 });

		expect(graph.diagnostics.map((d) => d.code)).toEqual([
			"MODULE_DEPTH_EXCEEDED",
		]);
	});
});
