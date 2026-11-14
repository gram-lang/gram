import { describe, expect, it } from "bun:test";
import { getAST, isSection } from "../src";

const span = (text: string, loc?: { start: number; end: number }) =>
	loc ? text.slice(loc.start, loc.end) : undefined;

describe("the location of an anchor", () => {
	it("covers the anchor of a section header, braces included", () => {
		const text = "## Brioche ~{-1j 12h} ->&dough{}\n\nKnead.\n";
		const section = getAST(text).children[0];
		if (!section || !isSection(section)) throw new Error("no section");
		expect(span(text, section.retroPlanning?.loc)).toBe("~{-1j 12h}");
	});

	it("covers an anchor written after the intermediate", () => {
		const text = "## Pastry ->&pastry ~{-2h}\n\nRoll.\n";
		const section = getAST(text).children[0];
		if (!section || !isSection(section)) throw new Error("no section");
		expect(span(text, section.retroPlanning?.loc)).toBe("~{-2h}");
	});

	it("covers the anchor of a @use directive", () => {
		const text =
			'@use "./pastry.gram" as &pastry ~{-1d}\n\n## Tart\n\nBake &pastry.\n';
		const decl = getAST(text).imports?.[0];
		expect(span(text, decl?.retroPlanning?.loc)).toBe("~{-1d}");
	});
});
