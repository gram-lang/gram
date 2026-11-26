import { describe, expect, it } from "bun:test";
import { createMemoryHost, loadModuleGraph } from "@gram-lang/modules";
import { parseDocument } from "../src/document-state";
import { provideDocumentLinks } from "../src/features/document-links";

const BASE = "## Pâte ->&pate\n\n[Mix] @flour{200g}.\n";

async function linksOf(text: string, files: Record<string, string>) {
	const host = createMemoryHost({ "/tarte.gram": text, ...files });
	const graph = await loadModuleGraph("/tarte.gram", host);
	const state = parseDocument(text, {}, 1, { graph, cache: new Map() });
	return provideDocumentLinks(state, "/tarte.gram");
}

describe("provideDocumentLinks", () => {
	it("links the path of an @use to the module it resolves to", async () => {
		const text =
			'@use "./bases/pate.gram" as &pate\n\n## Tarte\n\n[Use] &pate.\n';
		const links = await linksOf(text, { "/bases/pate.gram": BASE });
		expect(links).toEqual([
			{
				range: {
					start: { line: 0, character: 6 },
					end: { line: 0, character: 23 },
				},
				target: "/bases/pate.gram",
				tooltip: "/bases/pate.gram",
			},
		]);
	});

	it("resolves a root specifier as the compilation does", async () => {
		const text = '@use "@/pate.gram" as &pate\n\n## Tarte\n\n[Use] &pate.\n';
		const links = await linksOf(text, { "/pate.gram": BASE });
		expect(links.map((l) => l.target)).toEqual(["/pate.gram"]);
	});

	it("links every directive, and none to a module that cannot be found", async () => {
		const text =
			'@use "./pate.gram" as &pate\n@use "./missing.gram" as &creme\n\n## Tarte\n\n[Use] &pate and &creme.\n';
		const links = await linksOf(text, { "/pate.gram": BASE });
		expect(links.map((l) => l.target)).toEqual(["/pate.gram"]);
	});

	it("keeps the link to a module that does not parse", async () => {
		const text = '@use "./pate.gram" as &pate\n\n## Tarte\n\n[Use] &pate.\n';
		const links = await linksOf(text, { "/pate.gram": "## A\n@ <@parent\n" });
		expect(links.map((l) => l.target)).toEqual(["/pate.gram"]);
	});

	it("gives a relative tooltip on the filesystem", () => {
		const text = '@use "./pate.gram" as &pate\n\n## Tarte\n\n[Use] &pate.\n';
		const uri = "file:///home/cook/tarte.gram";
		const target = "file:///home/cook/bases/pate.gram";
		const state = parseDocument(text, {}, 1, {
			graph: {
				entry: uri,
				modules: new Map([
					[
						uri,
						{
							uri,
							source: text,
							ast: parseDocument(text).ast!,
							imports: [
								{ decl: parseDocument(text).ast!.imports[0]!, uri: target },
							],
						},
					],
				]),
				order: [uri],
				diagnostics: [],
			},
		});
		expect(provideDocumentLinks(state, uri)[0]?.tooltip).toBe(
			"bases/pate.gram",
		);
	});

	it("has nothing to link without imports", () => {
		const state = parseDocument("## Tarte\n\n[Mix] @flour{200g}.\n");
		expect(provideDocumentLinks(state, "/tarte.gram")).toEqual([]);
	});
});
