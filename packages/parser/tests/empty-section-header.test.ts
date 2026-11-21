import { describe, expect, it } from "bun:test";
import grammar from "../syntaxes/gram.tmLanguage.json";
import { ASTNodeType, getAST } from "../src/index";

// `##` alone is an untitled section header, like `## `: the formatter strips
// the blank after `## ` (rule 10), and `##` used to read as text plus a
// cookware named "#", so formatting dropped the section and added a tool
// with a hashed id to the recipe (#205).

// biome-ignore lint/suspicious/noExplicitAny: walking a parsed AST in tests.
const children = (src: string): any[] => getAST(src).children as any[];

describe("an untitled section header (#205)", () => {
	for (const header of ["##", "## ", "##\t", "##  \t"]) {
		it(`reads ${JSON.stringify(header)} as a section with no title`, () => {
			const [section] = children(`${header}\n\nMix.\n`);
			expect(section.type).toBe(ASTNodeType.Section);
			expect(section.title).toBe("");
			expect(section.retroPlanning).toBeNull();
			expect(section.intermediateDecl).toBeNull();
			expect(section.children).toHaveLength(1);
		});
	}

	it("reads `##` at the end of the file, and before another header", () => {
		expect(children("##")[0].type).toBe(ASTNodeType.Section);
		const [a, b] = children("##\n\n## B\n\nMix.\n");
		expect(a.title).toBe("");
		expect(a.children).toHaveLength(0);
		expect(b.title).toBe("B");
	});

	it("leaves `###` alone: it is not a header", () => {
		const [step] = children("###\n\nMix.\n");
		expect(step.type).toBe(ASTNodeType.Step);
	});

	it("highlights `##` alone as a header marker", () => {
		const rule = grammar.repository.sections;
		const regex = new RegExp(rule.match, "u");
		expect(regex.exec("##")?.[1]).toBe("##");
		expect(regex.exec("## Dough")?.[1]).toBe("##");
		expect(regex.exec("###")).toBeNull();
	});
});

// The formatter trims `~{ }` to `~{}` (rule 3). Empty braces used to stop
// being an anchor (the header fell back to a step), and after a declaration
// `->&dough ~{}` read as one intermediate named "dough ~" (#205).
describe("an empty section anchor (#205)", () => {
	for (const anchor of ["~{}", "~{ }"]) {
		it(`keeps the section of \`## Dough ${anchor}\``, () => {
			const [section] = children(`## Dough ${anchor}\n\nMix.\n`);
			expect(section.type).toBe(ASTNodeType.Section);
			expect(section.title).toBe("Dough");
			expect(section.retroPlanning?.raw).toBe("");
		});

		it(`reads \`->&dough ${anchor}\` as a declaration, then the anchor`, () => {
			const [section] = children(`## Dough ->&dough ${anchor}\n\nMix.\n`);
			expect(section.intermediateDecl.name).toBe("dough");
			expect(section.retroPlanning?.raw).toBe("");
		});

		it(`keeps an \`@use\` with ${anchor}`, () => {
			const [use] = getAST(`@use "./a.gram" as &a ${anchor}\n\nMix.\n`).imports;
			expect(use.retroPlanning?.raw).toBe("");
		});
	}

	it("still declares a multi-word intermediate before an anchor", () => {
		const [section] = children("## Pastry ->&short crust{} ~{-1d}\n\nMix.\n");
		expect(section.intermediateDecl.name).toBe("short crust");
		expect(section.retroPlanning.raw).toBe("-1d");
	});
});
