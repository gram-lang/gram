import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";

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

// Regression tests for the security audit (2026-07-22, finding B-1): the
// section title and named-timer breakdown labels shown in timing-card
// tooltips were interpolated into html.ts without escapeHtml(), unlike every
// other text field in the same file. The 4 enumerative cases above did not
// cover this — a payload here was exploitable via the playground/VS Code
// preview. `<` is rejected by the grammar's `name` rule for timer names, so
// the reproducer below uses the section title (unrestricted free text) for
// the actual tag-injection proof, and a timer name for the characters that
// rule *does* allow, as defense-in-depth for the same code path.
describe("toHTML XSS escaping — timing tooltips (audit 2026-07-22, finding B-1)", () => {
	it("escapes an HTML payload in a section title shown in the active-time tooltip", () => {
		const source = "## <script>alert(1)</script>\n\nMix @flour{200g}.\n";
		const compiled = compile(getAST(source));
		const html = toHTML(compiled);

		expect(html).not.toContain("<script>alert(1)</script>");
		expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
	});

	it("never leaks a named timer's special characters unescaped", () => {
		// The total-time tooltip used to list the critical path, timer names
		// included; it now lists the mise en place per section instead, so the
		// name no longer appears there. What must hold is that it never shows up raw.
		const source =
			"## Section\n\nMix @flour{200g}.\n\nWait ~_evil name>&{5min}.\n";
		const compiled = compile(getAST(source));
		const html = toHTML(compiled);

		expect(html).not.toContain("evil name>&");
	});
});

// The mise en place surfaces (total/prep tooltips, per-section badge, up-front
// block) take ingredient and section names straight from the recipe, and the
// badge puts them in a `data-tooltip` attribute — a quote or ampersand must
// not break out of it.
describe("mise en place XSS escaping", () => {
	const NAME = 'o"nion&s';
	const source = `## <b>Prep</b>\n\nSlice @${NAME}{200g}(finely chopped) in a #pan"x.\n`;
	const compiled = compile(getAST(source));

	for (const schedule of ["perSection", "upfront"] as const) {
		it(`escapes names in the ${schedule} HTML`, () => {
			const html = toHTML(compiled, { schedule });
			expect(html).not.toContain(NAME);
			expect(html).not.toContain("<b>Prep</b>");
			expect(html).toContain("o&quot;nion&amp;s");
		});

		it(`escapes names in the ${schedule} print HTML`, () => {
			const html = toPrintHTML(compiled, { schedule });
			expect(html).not.toContain(NAME);
			expect(html).not.toContain("<b>Prep</b>");
		});
	}
});

// P-5 from the renderer audit: a single parametrized sweep across text
// fields and HTML-producing backends, so a future field added to either
// backend without escaping is caught here instead of needing its own
// hand-written case (the exact gap that let B-1 through).
describe("escaping sweep — every text field, every HTML backend", () => {
	const PAYLOAD = "<script>alert(1)</script>";

	const fields: Record<string, string> = {
		"recipe title (frontmatter)": `---\ntitle: ${PAYLOAD}\n---\n## Section\n\nStep.\n`,
		"section title": `## ${PAYLOAD}\n\nStep.\n`,
		"step comment": `## Section\n\n// ${PAYLOAD}\n\nStep.\n`,
		"step free text": `## Section\n\nMix carefully ${PAYLOAD} now.\n`,
		"section title in a timing tooltip": `## ${PAYLOAD}\n\nMix @flour{200g}.\n`,
	};

	const backends: Record<string, (data: unknown) => string> = {
		toHTML: (data) => toHTML(data),
		toPrintHTML: (data) => toPrintHTML(data),
	};

	for (const [field, source] of Object.entries(fields)) {
		const compiled = compile(getAST(source));
		for (const [backendName, render] of Object.entries(backends)) {
			it(`never leaks a raw <script> payload from ${field} via ${backendName}`, () => {
				expect(render(compiled)).not.toContain(PAYLOAD);
			});
		}
	}
});

describe("toMarkdown escaping", () => {
	it("neutralizes a raw HTML payload in the recipe title (frontmatter)", () => {
		const source =
			"---\ntitle: <img src=x onerror=alert(1)>\n---\n## Section\nMix @flour{200g}.\n";
		const compiled = compile(getAST(source));
		const md = toMarkdown(compiled);

		// toMarkdown escapes `<`/`&` only (not full HTML entity escaping like
		// toHTML) — see explanation/engine/renderer.md for the rationale.
		expect(md).not.toContain("<img src=x onerror=alert(1)>");
		expect(md).toContain("&lt;img src=x onerror=alert(1)>");
	});

	it("neutralizes a raw HTML payload inside free step text", () => {
		const source = "## Section\nMix @flour{200g} carefully <b>now</b>.\n";
		const compiled = compile(getAST(source));
		const md = toMarkdown(compiled);

		expect(md).not.toContain("<b>now</b>");
		expect(md).toContain("&lt;b>now&lt;/b>");
	});
});
