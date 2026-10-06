import { describe, expect, it } from "bun:test";
import type { Root } from "mdast";
import type { VFile } from "vfile";
import {
	formatFrenchTypography,
	NBSP,
	NNBSP,
	remarkFrenchTypography,
} from "./remark-french-typography.ts";

describe("formatFrenchTypography", () => {
	it("replaces spaces before colons with standard non-breaking space", () => {
		expect(formatFrenchTypography("Voici : un test")).toBe(
			`Voici${NBSP}: un test`,
		);
		expect(formatFrenchTypography("Étape 1 : préparation")).toBe(
			`Étape 1${NBSP}: préparation`,
		);
		expect(formatFrenchTypography("Fin de phrase :")).toBe(
			`Fin de phrase${NBSP}:`,
		);
	});

	it("does not alter colons in URLs, code-like strings, or smileys", () => {
		expect(formatFrenchTypography("https://example.com")).toBe(
			"https://example.com",
		);
		expect(formatFrenchTypography("ratio 1:2")).toBe("ratio 1:2");
		expect(formatFrenchTypography("un smiley :) et un autre :D")).toBe(
			"un smiley :) et un autre :D",
		);
	});

	it("replaces spaces before question and exclamation marks with narrow non-breaking space", () => {
		expect(formatFrenchTypography("Qu'est-ce que c'est ?")).toBe(
			`Qu'est-ce que c'est${NNBSP}?`,
		);
		expect(formatFrenchTypography("Attention !")).toBe(`Attention${NNBSP}!`);
		expect(formatFrenchTypography("Incroyable !?!")).toBe(
			`Incroyable${NNBSP}!?!`,
		);
		expect(formatFrenchTypography("D'abord ; ensuite")).toBe(
			`D'abord${NNBSP}; ensuite`,
		);
	});

	it("handles French quotation marks « and »", () => {
		expect(formatFrenchTypography("« mot et mot »")).toBe(
			`«${NBSP}mot et mot${NBSP}»`,
		);
	});

	it("handles symbols like % and € after numbers", () => {
		expect(formatFrenchTypography("100 % de réussite")).toBe(
			`100${NBSP}% de réussite`,
		);
		expect(formatFrenchTypography("prix : 15 €")).toBe(
			`prix${NBSP}: 15${NBSP}€`,
		);
	});

	it("formats thousands separator in numbers", () => {
		expect(formatFrenchTypography("10 000 participants")).toBe(
			`10${NNBSP}000 participants`,
		);
		expect(formatFrenchTypography("1 000 000 d'euros")).toBe(
			`1${NNBSP}000${NNBSP}000 d'euros`,
		);
	});

	it("respects useNarrow: false option", () => {
		expect(formatFrenchTypography("Vraiment ?", false)).toBe(
			`Vraiment${NBSP}?`,
		);
		expect(formatFrenchTypography("10 000", false)).toBe(`10${NBSP}000`);
	});
});

describe("remarkFrenchTypography plugin", () => {
	it("skips non-French files", () => {
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "paragraph",
					children: [{ type: "text", value: "What is this ? Look :" }],
				},
			],
		};
		const file = { path: "/path/to/docs/en/intro.md" } as VFile;
		remarkFrenchTypography()(tree, file);

		const textNode = (tree.children[0] as any).children[0];
		expect(textNode.value).toBe("What is this ? Look :");
	});

	it("processes French files based on path", () => {
		const tree: Root = {
			type: "root",
			children: [
				{
					type: "paragraph",
					children: [
						{ type: "text", value: "C'est quoi Gram ? Voici :" },
						{ type: "inlineCode", value: "let x : number = 10;" },
					],
				},
			],
		};
		const file = { path: "/path/to/src/content/docs/fr/intro.mdx" } as VFile;
		remarkFrenchTypography()(tree, file);

		const textNode = (tree.children[0] as any).children[0];
		const codeNode = (tree.children[0] as any).children[1];

		expect(textNode.value).toBe(`C'est quoi Gram${NNBSP}? Voici${NBSP}:`);
		expect(codeNode.value).toBe("let x : number = 10;");
	});
});
