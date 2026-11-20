import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { project, runSheet } from "@gram-lang/scheduler";
import {
	formatElement,
	runSheetToHTML,
	runSheetToMarkdown,
	runSheetToText,
	toHTML,
	toMarkdown,
	toPrintHTML,
	toText,
} from "../src/index";

// A target state (`={ribbon stage}`, 1.5) is part of the sentence: every
// format shows its state where it was written, and its note (how to check)
// always, never only in a tooltip.

const withNote = {
	type: "checkpoint",
	state: "la nappe",
	note: "la crème nappe la cuillère",
};
const bare = { type: "checkpoint", state: "ruban" };
const icons = { checkpoint: "C" };

describe("a target state in each format", () => {
	it("text: the state, then the note", () => {
		expect(formatElement(withNote, "text")).toBe(
			"la nappe (la crème nappe la cuillère)",
		);
		expect(formatElement(bare, "text")).toBe("ruban");
		expect(
			formatElement(bare, "text", {
				textStyle: { checkpoint: (t) => `<${t}>` },
			}),
		).toBe("<ruban>");
	});

	it("Markdown: its icon, the state and the note, escaped", () => {
		expect(formatElement(withNote, "md", { icons })).toBe(
			"Cla nappe (la crème nappe la cuillère)",
		);
		expect(formatElement(bare, "md")).toBe("🎯 ruban");
		expect(
			formatElement({ ...bare, state: "<b>x</b>", note: "<i>y</i>" }, "md"),
		).not.toMatch(/<b>|<i>/);
	});

	it("HTML: a marked state, its note beside it in a group", () => {
		expect(formatElement(bare, "html", { icons })).toBe(
			'<span class="checkpoint" data-state="ruban">C ruban</span>',
		);
		expect(formatElement(withNote, "html", { icons })).toBe(
			'<span class="note-group"><span class="checkpoint" data-state="la nappe">C la nappe</span> <span class="prep">(la crème nappe la cuillère)</span></span>',
		);
		expect(formatElement(bare, "html")).toContain('class="gicon gicon-target"');
	});

	it("HTML: escapes the state and takes the classes of the context", () => {
		const html = formatElement(
			{ type: "checkpoint", state: '<b>"x"</b>', note: "<i>" },
			"html",
			{ icons, classes: { checkpoint: "c", noteGroup: "g", prepText: "n" } },
		);
		expect(html).toStartWith('<span class="g"><span class="c"');
		expect(html).not.toMatch(/<b>|<i>/);
		expect(html).toContain('<span class="n">(&lt;i&gt;)</span>');
	});
});

describe("a target state in the views", () => {
	const compiled = compile(
		getAST(
			"## Crème\n\nCuire ~{10 min} dans la #casserole jusqu'à ={la nappe}(la crème nappe la cuillère).\n\nFouetter jusqu'au ={ruban}, puis servir.\n",
		),
	);

	it("recipe, HTML and print: in the sentence, punctuation glued to it", () => {
		for (const html of [toHTML(compiled), toPrintHTML(compiled)]) {
			expect(html).toContain('data-state="la nappe"');
			expect(html).toContain(
				'<span class="prep">(la crème nappe la cuillère)</span></span>.',
			);
			expect(html).toMatch(/ruban<\/span>,/);
		}
	});

	it("recipe, Markdown and text: the state and the note in the sentence", () => {
		expect(toMarkdown(compiled)).toContain(
			"jusqu'à 🎯 la nappe (la crème nappe la cuillère).",
		);
		const text = toText(compiled) ?? "";
		expect(text).toContain("jusqu'à la nappe (la crème nappe la cuillère).");
		expect(text).toContain("jusqu'au ruban, puis servir.");
	});

	it("run sheet: in the sentence of the step, in every format", () => {
		const context = {
			serveAt: "2026-10-11T13:00",
			timeZone: "Europe/Paris",
			availability: { daily: [{ start: "08:00", end: "22:00" }] },
		};
		const sheet = runSheet(project([{ graph: compiled.tasks }], context), {
			graph: compiled.tasks,
			context,
		});
		expect(runSheetToHTML(sheet, compiled)).toContain('data-state="la nappe"');
		expect(runSheetToMarkdown(sheet, compiled)).toContain(
			"🎯 la nappe (la crème nappe la cuillère)",
		);
		expect(runSheetToText(sheet, compiled)).toContain(
			"la nappe (la crème nappe la cuillère)",
		);
	});
});

// Every token a compiled step may hold says something in every format: a
// token with no strategy fell back to an empty string, and a word of the
// sentence vanished ("Cook until .").
describe("every kind of step token", () => {
	const tokens = [
		{ type: "timer", quantity: { type: "single", value: 5 }, unit: "min" },
		{ type: "temperature", text: "high" },
		{ type: "checkpoint", state: "golden" },
		{ type: "declaration", name: "dough" },
		{ type: "reference", id: "dough", name: "dough" },
		{ type: "comment", value: "aside" },
		{ id: "flour", name: "flour" },
	];

	it.each(tokens)("renders %o in every format", (token) => {
		for (const format of ["html", "md", "text"] as const) {
			expect(formatElement(token, format).trim()).not.toBe("");
		}
	});
});
