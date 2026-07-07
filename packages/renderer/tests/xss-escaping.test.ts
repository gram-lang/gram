import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown } from "../src/index";

// Regression tests for the HTML-escaping discipline documented in the security
// audit (Phase 3): @gram-lang/renderer's HTML output is the only thing standing
// between untrusted recipe content (pasted from scraped web pages via `gram
// import`, or shared/cloned .gram files) and the VSCode preview webview.
// If any of these ever fail, escapeHtml() coverage regressed somewhere.

describe("toHTML XSS escaping", () => {
	it("escapes an HTML payload in the recipe title (frontmatter)", () => {
		const source =
			"---\ntitle: <img src=x onerror=alert(1)>\n---\n## Section\nMix @flour{200g}.\n";
		const compiled = compile(getAST(source));
		const html = toHTML(compiled);

		expect(html).not.toContain("<img src=x onerror=alert(1)>");
		expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
	});

	it("escapes an HTML payload inside a step comment", () => {
		const source =
			"## Section\n// <script>alert(1)</script>\nMix @flour{200g}.\n";
		const compiled = compile(getAST(source));
		const html = toHTML(compiled);

		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
	});

	it("escapes an HTML payload inside free step text", () => {
		const source = "## Section\nMix @flour{200g} carefully <b>now</b>.\n";
		const compiled = compile(getAST(source));
		const html = toHTML(compiled);

		expect(html).not.toContain("<b>now</b>");
		expect(html).toContain("&lt;b&gt;now&lt;/b&gt;");
	});
});

describe("toMarkdown escaping (known limitation, not a regression)", () => {
	it("does NOT escape HTML — characterizes existing behavior documented in build-custom-ui.md", () => {
		const source =
			"---\ntitle: <img src=x onerror=alert(1)>\n---\n## Section\nMix @flour{200g}.\n";
		const compiled = compile(getAST(source));
		const md = toMarkdown(compiled);

		// If this assertion ever flips to escaped, update docs/how-to/build-custom-ui.md
		// (the sanitization warning) accordingly instead of treating it as a silent win.
		expect(md).toContain("<img src=x onerror=alert(1)>");
	});
});
