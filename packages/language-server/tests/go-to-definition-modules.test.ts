import { describe, it, expect } from "bun:test";
import { loadModuleGraph, type ModuleHost } from "@gram-lang/modules";
import { parseDocument } from "../src/document-state";
import { provideDefinition } from "../src/features/go-to-definition";

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

describe("provideDefinition — cross-file (module-imports RFC §F.1)", () => {
	it("jumps into the base file's exported section for a single-binding import", async () => {
		const topText =
			'@use "./base.gram" as &pate\n\n## Montage\n\n[Use] the &pate{200g}.\n';
		const baseText = "## Base\n\n[Mix] the @flour{200g}.\n";
		const host = createFakeHost({
			"/top.gram": topText,
			"/base.gram": baseText,
		});
		const graph = await loadModuleGraph("/top.gram", host);
		const state = parseDocument(topText, {}, 1, { graph, cache: new Map() });

		// Position on "&pate" in "[Use] the &pate{200g}." — find it dynamically.
		const usageOffset = topText.lastIndexOf("&pate");
		const before = topText.slice(0, usageOffset);
		const line = before.split("\n").length - 1;
		const character = usageOffset - before.lastIndexOf("\n") - 1;

		const loc = provideDefinition(state, "/top.gram", { line, character });

		expect(loc).not.toBeNull();
		expect(loc!.uri).toBe("/base.gram");
		// Base has one section ("## Base"), no explicit ->& — anchors at the
		// section itself, which starts at offset 0.
		expect(loc!.range.start.line).toBe(0);
	});

	it("jumps to the specific exported section for a destructured binding", async () => {
		const topText =
			'@use "./base.gram" as { &blancs, &jaunes }\n\n## Montage\n\n[Use] the &jaunes{2}.\n';
		const baseText =
			"## Blancs ->&blancs\n\n[Séparer] les blancs.\n\n## Jaunes ->&jaunes\n\n[Séparer] les jaunes.\n";
		const host = createFakeHost({
			"/top.gram": topText,
			"/base.gram": baseText,
		});
		const graph = await loadModuleGraph("/top.gram", host);
		const state = parseDocument(topText, {}, 1, { graph, cache: new Map() });

		const usageOffset = topText.lastIndexOf("&jaunes");
		const before = topText.slice(0, usageOffset);
		const line = before.split("\n").length - 1;
		const character = usageOffset - before.lastIndexOf("\n") - 1;

		const loc = provideDefinition(state, "/top.gram", { line, character });

		expect(loc).not.toBeNull();
		expect(loc!.uri).toBe("/base.gram");
		// Must land on the "## Jaunes" section, not "## Blancs".
		expect(loc!.range.start.line).toBe(
			baseText.slice(0, baseText.indexOf("## Jaunes")).split("\n").length - 1,
		);
	});

	it("still resolves a purely local (non-import) intermediate within the same file", () => {
		const text =
			"## Base ->&dough\n\n[Mix] the @flour{200g}.\n\n## Use\n\n[Roll] out the &dough.\n";
		const state = parseDocument(text, {}, 1);

		const usageOffset = text.lastIndexOf("&dough");
		const before = text.slice(0, usageOffset);
		const line = before.split("\n").length - 1;
		const character = usageOffset - before.lastIndexOf("\n") - 1;

		const loc = provideDefinition(state, "/solo.gram", { line, character });

		expect(loc).not.toBeNull();
		expect(loc!.uri).toBe("/solo.gram");
		expect(loc!.range.start.line).toBe(0);
	});

	it("returns null for a reference to an unresolved import binding", async () => {
		const topText =
			'@use "./missing.gram" as &pate\n\n## Montage\n\n[Use] the &pate{200g}.\n';
		const host = createFakeHost({ "/top.gram": topText });
		const graph = await loadModuleGraph("/top.gram", host);
		const state = parseDocument(topText, {}, 1, { graph, cache: new Map() });

		const usageOffset = topText.lastIndexOf("&pate");
		const before = topText.slice(0, usageOffset);
		const line = before.split("\n").length - 1;
		const character = usageOffset - before.lastIndexOf("\n") - 1;

		const loc = provideDefinition(state, "/top.gram", { line, character });
		expect(loc).toBeNull();
	});
});
