import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { project, runSheet } from "@gram-lang/scheduler";
import {
	describeRunSheet,
	runSheetToHTML,
	runSheetToMarkdown,
	runSheetToText,
	toHTML,
	toMarkdown,
	toPrintHTML,
} from "../src/index";
import { withoutComments } from "../src/comments";

const SRC =
	"## Cake\n\n[Mix] Mix @flour{100g} // keep it cold\nand stir ~{5min}.\n\n// Do not overmix.\n\n[Bake] Bake at ^{200C}.\n";
const compiled = compile(getAST(SRC));
const ctx = {
	serveAt: "2026-11-08T16:30",
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
};
const sheet = runSheet(project([{ graph: compiled.tasks }], ctx), {
	graph: compiled.tasks,
	context: ctx,
});

describe("the comments option, in the recipe views", () => {
	for (const [name, view] of [
		["toHTML", toHTML],
		["toMarkdown", toMarkdown],
		["toPrintHTML", toPrintHTML],
	] as const) {
		it(`${name}: shows the comments by default, hides them on request`, () => {
			const shown = view(compiled);
			expect(shown).toContain("Do not overmix.");
			expect(shown).toContain("keep it cold");
			for (const options of [{ comments: "show" as const }, {}]) {
				expect(view(compiled, options)).toContain("Do not overmix.");
			}
			const hidden = view(compiled, { comments: "hide" });
			expect(hidden).not.toContain("Do not overmix.");
			expect(hidden).not.toContain("keep it cold");
			// The steps themselves, and their numbers, stay.
			expect(hidden).toContain("Bake");
		});
	}

	it("leaves no empty notes section behind", () => {
		const hidden = toHTML(compiled, { comments: "hide" });
		expect(hidden).not.toContain("recipe-notes");
		expect(toHTML(compiled)).toContain("recipe-notes");
	});

	it("does not change the recipe it is given", () => {
		const before = JSON.stringify(compiled.sections);
		withoutComments(compiled);
		toHTML(compiled, { comments: "hide" });
		expect(JSON.stringify(compiled.sections)).toBe(before);
	});

	it("hides them in the work plan written after the recipe too", () => {
		const html = toHTML(compiled, { runSheet: sheet, comments: "hide" });
		expect(html).not.toContain("Do not overmix.");
		expect(html).not.toContain("keep it cold");
		const shown = toHTML(compiled, { runSheet: sheet });
		expect(shown).toContain("Do not overmix.");
		expect(shown).toContain("inline-comment");
	});
});

describe("the comments option, in the work plan", () => {
	it("shows a comment at the end of a line inside its sentence, set apart", () => {
		const [line] = describeRunSheet(sheet, compiled).days[0]!.visits[0]!
			.program;
		expect(line!.steps.map((s) => s.text)).toEqual([
			"Mix flour (keep it cold) and stir 5 min.",
			"Do not overmix.",
			"Bake at 200 °C.",
		]);
		expect(runSheetToHTML(sheet, compiled)).toContain(
			'<span class="inline-comment">(keep it cold)</span>',
		);
		expect(runSheetToMarkdown(sheet, compiled)).toContain(
			"Mix **flour** *(keep it cold)* and stir",
		);
		expect(runSheetToText(sheet, compiled)).toContain(
			"Mix flour (keep it cold) and stir 5 min.",
		);
	});

	it("hides every comment on request, the steps keeping their numbers", () => {
		const options = { comments: "hide" } as const;
		const [line] = describeRunSheet(sheet, compiled, options).days[0]!
			.visits[0]!.program;
		expect(line!.steps.map((s) => [s.number, s.text])).toEqual([
			[1, "Mix flour and stir 5 min."],
			[2, "Bake at 200 °C."],
		]);
		for (const out of [
			runSheetToHTML(sheet, compiled, options),
			runSheetToMarkdown(sheet, compiled, options),
			runSheetToText(sheet, compiled, options),
		]) {
			expect(out).not.toContain("keep it cold");
			expect(out).not.toContain("Do not overmix.");
		}
	});

	it("tells the same without the option as with show", () => {
		expect(runSheetToHTML(sheet, compiled, { comments: "show" })).toBe(
			runSheetToHTML(sheet, compiled),
		);
	});
});
