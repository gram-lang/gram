import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { project, runSheet } from "@gram-lang/scheduler";
import { toHTML, toMarkdown, toPrintHTML } from "../src/index";

const BREAD = `---
title: Country bread
---

## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350ml} and knead ~{20min}.

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Shape &dough{850g} and bake for ~{30min}.
`;

const compiled = compile(getAST(BREAD));
const sheet = runSheet(
	project([{ graph: compiled.tasks, title: "Country bread" }], {
		serveAt: "2026-10-11T13:00",
		timeZone: "Europe/Paris",
		availability: { daily: [{ start: "08:00", end: "22:00" }] },
	}),
	{ graph: compiled.tasks },
);

describe("the work plan after the recipe", () => {
	it("is written after the nutrition, one heading level down in Markdown", () => {
		const md = toMarkdown(compiled, { runSheet: sheet });
		expect(md.indexOf("## Work plan — Country bread")).toBeGreaterThan(
			md.indexOf("## 👨‍🍳 Instructions"),
		);
		expect(md).toContain("### Saturday, October 10 · ");
		expect(md).toContain("> **To fix**");
		expect(md.match(/^# /gm)).toHaveLength(1); // only the recipe's own title
	});

	it("follows the recipe in HTML and in the print document, with its styles", () => {
		const html = toHTML(compiled, { runSheet: sheet });
		expect(html.indexOf('<section class="gram-run-sheet">')).toBeGreaterThan(
			html.indexOf('<div class="instructions">'),
		);
		const print = toPrintHTML(compiled, { runSheet: sheet });
		expect(print).toContain('<section class="gram-run-sheet">');
		expect(print).toContain(".work-plan-day");
	});

	it("is not written unless asked for", () => {
		expect(toMarkdown(compiled)).not.toContain("Work plan");
		expect(toHTML(compiled)).not.toContain("gram-run-sheet");
		expect(toPrintHTML(compiled)).not.toContain(".work-plan-day");
	});

	it("leaves the recipe as it always read: no time, no day next to the steps", () => {
		const md = toMarkdown(compiled, { runSheet: sheet });
		expect(md.slice(0, md.indexOf("## Work plan"))).not.toContain("around ");
		const html = toHTML(compiled, { runSheet: sheet });
		expect(html).not.toContain("step-plan");
		expect(html).not.toContain(`class="plan-summary"`);
	});
});
