import { describe, it, expect } from "bun:test";
import { loadModuleGraph, type ModuleHost } from "@gram-lang/modules";
import { parseDocument } from "../src/document-state";
import { provideDiagnostics } from "../src/features/diagnostics";
import { provideCodeActions } from "../src/features/code-actions";

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

describe("provideCodeActions — MODULE_EXPORT_NOT_FOUND re-export hint", () => {
	it("offers a cross-file quick-fix that appends '->&name' to the section that declares it", async () => {
		const topText =
			'@use "./sauce.gram" as { &bouillon }\n\n## Dessert\n\nWhisk &bouillon{1}.\n';
		// "bouillon" is a private, step-level intermediate declared inside
		// "Extra" — a section with no section-level export of its own, so
		// appending "->&bouillon" to its header is a safe, unambiguous fix.
		const sauceText =
			"## Sauce ->&sauce\n\nReduce @stock{200g}.\n\n## Extra\n\nMix @cream{100g}. ->&bouillon\n";
		const host = createFakeHost({
			"/top.gram": topText,
			"/sauce.gram": sauceText,
		});
		const graph = await loadModuleGraph("/top.gram", host);
		const state = parseDocument(topText, {}, 1, { graph, cache: new Map() });

		const diags = provideDiagnostics(state, "/top.gram");
		const diag = diags.find((d) => d.code === "MODULE_EXPORT_NOT_FOUND");
		expect(diag).toBeDefined();
		expect(diag!.message).toContain("isn't re-exported");

		const actions = provideCodeActions(
			state,
			diag!.range,
			[diag!],
			"/top.gram",
			{},
		);
		const fix = actions.find((a) => a.title.includes("Re-export"));
		expect(fix).toBeDefined();

		const edits = fix!.edit!.changes!["/sauce.gram"];
		expect(edits).toBeDefined();
		expect(edits).toHaveLength(1);
		expect(edits![0]!.newText).toBe(" ->&bouillon");

		// Applying the edit lands right after "## Extra", not after "## Sauce
		// ->&sauce" (which already has its own export and must stay untouched).
		const lines = sauceText.split("\n");
		expect(edits![0]!.range.start.line).toBe(lines.indexOf("## Extra"));
	});

	it("offers no quick-fix when the declaring section already has its own export", async () => {
		const topText =
			'@use "./sauce.gram" as { &bouillon }\n\n## Dessert\n\nWhisk &bouillon{1}.\n';
		// "bouillon" is declared in the same section as the "sauce" export —
		// a section carries at most one "->&", so the fix can't be automated.
		const sauceText =
			"## Sauce ->&sauce\n\nReduce @stock{200g}. Mix @cream{100g}. ->&bouillon\n";
		const host = createFakeHost({
			"/top.gram": topText,
			"/sauce.gram": sauceText,
		});
		const graph = await loadModuleGraph("/top.gram", host);
		const state = parseDocument(topText, {}, 1, { graph, cache: new Map() });

		const diags = provideDiagnostics(state, "/top.gram");
		const diag = diags.find((d) => d.code === "MODULE_EXPORT_NOT_FOUND");
		expect(diag).toBeDefined();

		const actions = provideCodeActions(
			state,
			diag!.range,
			[diag!],
			"/top.gram",
			{},
		);
		expect(actions.find((a) => a.title.includes("Re-export"))).toBeUndefined();
	});
});
