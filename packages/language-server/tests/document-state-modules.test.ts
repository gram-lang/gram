import { describe, it, expect } from "bun:test";
import { loadModuleGraph, type ModuleHost } from "@gram-lang/modules";
import { parseDocument } from "../src/document-state";

/** A minimal in-memory ModuleHost, POSIX-style absolute uris, no real filesystem. */
function createFakeHost(files: Record<string, string>): ModuleHost {
	return {
		resolve(specifier: string, fromUri: string): string {
			const fromDir = fromUri.slice(0, fromUri.lastIndexOf("/")) || "/";
			const parts = `${fromDir}/${specifier}`.split("/");
			const stack: string[] = [];
			for (const part of parts) {
				if (part === "" || part === ".") continue;
				if (part === "..") stack.pop();
				else stack.push(part);
			}
			return `/${stack.join("/")}`;
		},
		read(uri: string): string {
			if (!(uri in files)) throw new Error(`ENOENT: ${uri}`);
			return files[uri]!;
		},
	};
}

describe("parseDocument with a module graph", () => {
	it("resolves @use imports into compilation when a graph is supplied", async () => {
		const host = createFakeHost({
			"/base.gram": "## Base\n\n[Mix] the @flour{200g}.\n",
			"/tarte.gram":
				'@use "./base.gram" as &base\n\n## Montage\n\n[Use] the &base{200g}.\n',
		});
		const graph = await loadModuleGraph("/tarte.gram", host);
		const text =
			'@use "./base.gram" as &base\n\n## Montage\n\n[Use] the &base{200g}.\n';

		const state = parseDocument(text, {}, 1, { graph, cache: new Map() });

		expect(state.parseError).toBeNull();
		expect(state.compilation).not.toBeNull();
		const ids = state.compilation!.shopping_list.map((i) => i.id);
		expect(ids).toContain("flour");
	});

	it("without a graph, an @use import degrades to the pre-modules fallback instead of resolving", async () => {
		const text =
			'@use "./base.gram" as &base\n\n## Montage\n\n[Use] the &base{200g}.\n';
		const state = parseDocument(text, {}, 1);

		expect(state.parseError).toBeNull();
		// No graph means no splice: &base is just an unresolved intermediate
		// binding, so "flour" (only declared in base.gram) never appears.
		const ids = state.compilation?.shopping_list.map((i) => i.id) ?? [];
		expect(ids).not.toContain("flour");
	});

	it("state.ast stays this document's own single-file parse, not the composed splice", async () => {
		const host = createFakeHost({
			"/base.gram": "## Base\n\n[Mix] the @flour{200g}.\n",
			"/tarte.gram":
				'@use "./base.gram" as &base\n\n## Montage\n\n[Use] the &base{200g}.\n',
		});
		const graph = await loadModuleGraph("/tarte.gram", host);
		const text =
			'@use "./base.gram" as &base\n\n## Montage\n\n[Use] the &base{200g}.\n';

		const state = parseDocument(text, {}, 1, { graph, cache: new Map() });

		// The composed AST would have 2 sections (Base + Montage); this
		// document's own AST must only ever show the one it actually wrote.
		expect(state.ast?.children.length).toBe(1);
	});

	it("a module diagnostic (e.g. a missing base file) surfaces as a compiler warning", async () => {
		const host = createFakeHost({
			"/tarte.gram":
				'@use "./missing.gram" as &base\n\n## Montage\n\n[Use] the &base{200g}.\n',
		});
		const graph = await loadModuleGraph("/tarte.gram", host);
		const text =
			'@use "./missing.gram" as &base\n\n## Montage\n\n[Use] the &base{200g}.\n';

		const state = parseDocument(text, {}, 1, { graph, cache: new Map() });

		expect(
			state.compilation?.warnings.some((w) => w.code === "MODULE_NOT_FOUND"),
		).toBe(true);
	});
});
