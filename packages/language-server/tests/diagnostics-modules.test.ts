import { describe, it, expect } from "bun:test";
import { loadModuleGraph, type ModuleHost } from "@gram-lang/modules";
import { parseDocument } from "../src/document-state";
import { provideDiagnostics } from "../src/features/diagnostics";

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

describe("provideDiagnostics — cross-file (module-imports RFC §F.1)", () => {
	it("anchors a diagnostic raised in a nested dependency at this document's own @use line, with relatedInformation pointing into the dependency", async () => {
		const topText =
			'@use "./mid.gram" as &mid\n\n## Montage\n\n[Use] the &mid{200g}.\n';
		const midText =
			'@use "./missing.gram" as &missing\n\n## Mid\n\n[Use] the &missing{100g}.\n';
		const host = createFakeHost({
			"/top.gram": topText,
			"/mid.gram": midText,
		});
		const graph = await loadModuleGraph("/top.gram", host);
		const state = parseDocument(topText, {}, 1, { graph, cache: new Map() });

		const diags = provideDiagnostics(state, "/top.gram");
		const notFound = diags.find((d) => d.code === "MODULE_NOT_FOUND");

		expect(notFound).toBeDefined();
		// Anchored at top.gram's own `@use "./mid.gram"` line (offset 0), not a
		// nonsense position derived from reading mid.gram's offset against
		// top.gram's line index.
		expect(notFound!.range.start.line).toBe(0);
		expect(notFound!.relatedInformation).toBeDefined();
		expect(notFound!.relatedInformation![0]!.location.uri).toBe("/mid.gram");
	});

	it("a same-file diagnostic gets no relatedInformation", async () => {
		const state = parseDocument("## Section\nUse &ghost.\n");
		const diags = provideDiagnostics(state, "/solo.gram");
		const undefinedRef = diags.find((d) => d.code === "UNDEFINED_REFERENCE");
		expect(undefinedRef).toBeDefined();
		expect(undefinedRef!.relatedInformation).toBeUndefined();
	});
});
