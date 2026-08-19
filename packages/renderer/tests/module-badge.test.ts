import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";

// `ProcessedSection.module` is stamped by `@gram-lang/modules` after
// compile() runs (see finalizeComposed) — the renderer only cares that the
// field is present, not how it got there, so a plain compile() + manual
// stamp is enough to exercise the renderer's own badge logic in isolation
// from the whole module-composition pipeline (already covered by
// packages/modules/tests/compose.test.ts). A `--stock`ed import never
// splices a section (module-imports RFC, stock/retro-planning redesign), so
// `sec.module` here is always `mode: "inline"` in practice — badge rendering
// no longer branches on mode at all.
function compileWithModule() {
	const result = compile(getAST("## Montage\nUse the base.\n"));
	Object.assign(result.sections[0]!, {
		module: {
			binding: "pate",
			uri: "./bases/pate.gram",
			title: "Pate Sablee",
			mode: "inline",
		},
	});
	return result;
}

describe("module provenance badge rendering", () => {
	it("credits the source module in the HTML badge", () => {
		const html = toHTML(compileWithModule());
		expect(html).toContain("section-meta-module");
		expect(html).toContain("Pate Sablee");
	});

	it("credits the source module parenthetically in markdown", () => {
		const md = toMarkdown(compileWithModule());
		expect(md).toContain("### Montage _(Pate Sablee)_");
	});

	it("shows the module credit parenthetically in print HTML", () => {
		const html = toPrintHTML(compileWithModule());
		expect(html).toContain("Pate Sablee");
	});

	it("falls back to the binding name when the module has no title", () => {
		const result = compile(getAST("## Montage\nUse the base.\n"));
		Object.assign(result.sections[0]!, {
			module: {
				binding: "pate",
				uri: "./bases/pate.gram",
				title: null,
				mode: "inline",
			},
		});
		const html = toHTML(result);
		expect(html).toContain("></i> pate</small>");
	});

	it("escapes a module title that could inject markup", () => {
		const result = compile(getAST("## Montage\nUse the base.\n"));
		Object.assign(result.sections[0]!, {
			module: {
				binding: "pate",
				uri: "./bases/pate.gram",
				title: "<img src=x onerror=alert(1)>",
				mode: "inline",
			},
		});
		const html = toHTML(result);
		expect(html).not.toContain("<img");
		expect(html).toContain("&lt;img");
	});
});
