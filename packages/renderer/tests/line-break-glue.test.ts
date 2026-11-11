import { describe, it, expect } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "@gram-lang/kitchen";
import { project, runSheet } from "@gram-lang/scheduler";
import { runSheetToHTML, toHTML, toPrintHTML } from "../src/index";
import { joinStepTokens, nobr, trimBeforeComments } from "../src/shared/utils";
import base from "../src/shared/base.css" with { type: "text" };
import printBase from "../src/shared/print.css" with { type: "text" };

// A footnote mark must never start a line on its own: the space before it is
// dropped and a word joiner (U+2060) glues it to the word it annotates.
const WJ = "&#8288;";

describe("footnote marks stay on the line of their word; step results get their own line", () => {
	const compiled = compile(
		getAST(
			"## Pâte\n\n[Mélanger] la @farine{300 g} et le @lait{1 l}. ->&pâte\n\n[Cuire] pendant ~{30 min}. // Ajuster selon la coloration\n",
		),
	);

	it("HTML: a word joiner precedes every footnote mark", () => {
		const html = toHTML(compiled);
		expect(html).toContain(`${WJ}<sup class="footnote-ref">`);
		expect(html).not.toMatch(/[^;]<sup class="footnote-ref">/);
	});

	it("HTML: the space written before `//` is dropped, so nothing can break before the mark", () => {
		const html = toHTML(compiled);
		expect(html).not.toMatch(/\s&#8288;<sup class="footnote-ref">/);
		expect(html).toContain(`.${WJ}<sup class="footnote-ref">`);
	});

	it("HTML: what a step makes is written on a line of its own under the step", () => {
		const html = toHTML(compiled);
		expect(html).toMatch(
			/<span class="step-result"><svg[\s\S]*?<\/svg> <span class="declaration step-result-item" data-declares="p[^"]*">pâte<\/span><\/span>/,
		);
		expect(html).not.toContain("declaration-badge");
	});

	it("HTML: several results share one line, separated by commas", () => {
		const html = toHTML(
			compile(
				getAST("## Prep\n\n[Séparer] les @oeufs{2}. ->&jaunes{} ->&blancs{}\n"),
			),
		);
		expect(html).toMatch(
			/step-result-item"[^>]*>jaunes<\/span>, <span class="declaration step-result-item"[^>]*>blancs<\/span>/,
		);
	});

	it("Print HTML gets the same glue", () => {
		expect(toPrintHTML(compiled)).toContain(`${WJ}<sup class="footnote-ref">`);
	});

	it("HTML: a declaration between the sentence and the comment leaves no space behind", () => {
		const html = toHTML(
			compile(
				getAST(
					"## Prep\n\n[Chauffer] Dans une #casserole, l'@eau{150 ml} et le @beurre{100 g}. ->&liquides // Retirer du feu dès que le beurre est fondu.\n",
				),
			),
		);
		expect(html).toContain(`.${WJ}<sup class="footnote-ref">`);
		expect(html).not.toMatch(/\s&#8288;<sup class="footnote-ref">/);
	});
});

describe("trimBeforeComments", () => {
	const comment = { type: "comment", value: "note" } as any;
	const element = { type: "ingredient", id: "beurre" } as any;

	it("removes the whitespace spread over several text tokens before a comment", () => {
		expect(trimBeforeComments([element, ". ", " ", "\t", comment])).toEqual([
			element,
			".",
			"",
			"",
			comment,
		]);
	});

	it("stops at the first element: the space after a word or an element goes, nothing more", () => {
		expect(trimBeforeComments(["le ", element, " ", comment])).toEqual([
			"le ",
			element,
			"",
			comment,
		]);
	});

	it("handles any whitespace, in any language, and leaves text away from a comment alone", () => {
		expect(
			trimBeforeComments([
				"Mélanger\u00a0 ",
				comment,
				" puis cuire. ",
				element,
			]),
		).toEqual(["Mélanger", comment, " puis cuire. ", element]);
	});

	it("does not mutate the tokens it is given", () => {
		const tokens = ["texte ", comment];
		trimBeforeComments(tokens);
		expect(tokens).toEqual(["texte ", comment]);
	});
});

// A step element drawn as a box (a timer, a temperature) lets a line break
// right against it, punctuation or not; a word joiner does not stop that, but
// `white-space: nowrap` does. So the HTML views wrap an element and what
// touches it in `.gram-nobr`, whose children still wrap inside themselves.
describe("an element and the punctuation that touches it stay on one line", () => {
	const timer = { type: "timer" } as const;
	const temp = { type: "temp" } as const;
	const render = (t: unknown) =>
		typeof t === "string" ? t : `<${(t as { type: string }).type}/>`;
	const spaceable = (t: unknown) => typeof t !== "string";
	const glue = (tokens: unknown[]) =>
		joinStepTokens(tokens as never[], render, spaceable, nobr);

	it("glues the full stop after an element", () => {
		expect(glue(["for at least ", timer, ". Then serve."])).toBe(
			'for at least <span class="gram-nobr"><timer/>.</span> Then serve.',
		);
	});

	it("glues the parenthesis before and after an element", () => {
		expect(glue(["Bake (", temp, ") now"])).toBe(
			'Bake <span class="gram-nobr">(<temp/>)</span> now',
		);
	});

	it("glues a whole run of punctuation, and a word written against the element", () => {
		expect(glue(["at ", temp, "?!… Done"])).toBe(
			'at <span class="gram-nobr"><temp/>?!…</span> Done',
		);
	});

	it("keeps two elements joined by punctuation with no space in one run", () => {
		expect(glue(["(", timer, ")-(", temp, ")."])).toBe(
			'<span class="gram-nobr">(<timer/>)-(<temp/>).</span>',
		);
	});

	it("leaves an element surrounded by spaces alone", () => {
		expect(glue(["Bake at ", temp, " for ", timer, " then"])).toBe(
			"Bake at <temp/> for <timer/> then",
		);
	});

	it("glues nothing without a glue: Markdown and plain text are left as they were", () => {
		expect(
			joinStepTokens(["for ", timer, "."] as never[], render, spaceable),
		).toBe("for <timer/>.");
	});

	const SRC = "## Pâte\n\nChill for at least ~{30 min}. Then bake (^{200C}).\n";
	const compiled = compile(getAST(SRC));

	for (const [name, out] of [
		["HTML", () => toHTML(compiled)],
		["print", () => toPrintHTML(compiled)],
	] as const) {
		it(`${name}: the timer keeps its full stop, the temperature its parentheses`, () => {
			const html = out();
			expect(html).toMatch(
				/<span class="gram-nobr"><span class="timer[^"]*"[^>]*>[\s\S]*?<\/span><\/span>\.<\/span>/,
			);
			expect(html).toMatch(
				/<span class="gram-nobr">\(<span class="temp[^"]*"[^>]*>[\s\S]*?<\/span>\)\.<\/span>/,
			);
		});
	}

	it("run sheet: the same glue in its steps", () => {
		const ctx = {
			serveAt: "2026-11-08T16:30",
			timeZone: "Europe/Paris",
			availability: { daily: [{ start: "08:00", end: "22:00" }] },
		};
		const sheet = runSheet(project([{ graph: compiled.tasks }], ctx), {
			graph: compiled.tasks,
			context: ctx,
		});
		const html = runSheetToHTML(sheet, compiled);
		expect(html).toMatch(
			/<span class="gram-nobr"><span class="timer[\s\S]*?\.<\/span>/,
		);
		expect(html).toMatch(/<span class="gram-nobr">\(<span class="temp/);
	});

	it("both stylesheets define the glue, and let the element wrap inside", () => {
		for (const css of [base, printBase]) {
			expect(css).toMatch(/\.gram-nobr\s*\{\s*white-space:\s*nowrap;/);
			expect(css).toMatch(
				/:where\(\.gram-nobr > \*\)\s*\{\s*white-space:\s*normal;/,
			);
		}
	});
});
