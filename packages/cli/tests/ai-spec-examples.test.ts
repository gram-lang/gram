import { describe, expect, it } from "bun:test";
import {
	compile,
	deprecatedFrontmatterKeysIn,
	FRONTMATTER_KEYS,
	WarningCode,
	warningSeverity,
} from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { GRAM_SPEC_PROMPT } from "../src/prompts/gram-spec";

// The prompt `gram import` sends to the AI is its only model of Gram: an
// example that no longer compiles, warns, or uses a deprecated key teaches
// the mistake to every imported recipe. Each example is one of three kinds,
// the ❌ being the marker:
// - a full recipe (opens with `---`, or the reference recipe of SECTION 8):
//   compiles with no warning, its frontmatter read key for key, with no
//   comment in a value and no deprecated key;
// - a snippet (no frontmatter, no ❌): the same, except that it may cite an
//   intermediate the rest of the recipe would declare (UNDEFINED_REFERENCE);
// - a counter-example (holds a ❌): not valid on purpose, but each of its ✅
//   lines is checked as a snippet.

/**
 * The body of every fence: a line that is only ``` (after any indentation)
 * opens one, the same indentation followed by ``` closes it, and that
 * indentation is taken off the body. A ```gram written after a ❌ inside
 * another fence opens nothing, and a fence indented under a list item is
 * still found.
 */
function fences(text: string): string[] {
	const bodies: string[] = [];
	let buffer: string[] | null = null;
	let indent = "";
	for (const line of text.split("\n")) {
		if (buffer === null) {
			const open = /^( *)```\w*$/.exec(line);
			if (open) {
				buffer = [];
				indent = open[1] ?? "";
			}
		} else if (line === `${indent}\`\`\``) {
			bodies.push(`${buffer.join("\n")}\n`);
			buffer = null;
		} else {
			buffer.push(line.startsWith(indent) ? line.slice(indent.length) : line);
		}
	}
	return bodies;
}

/** SECTION 8's reference recipe, in no fence: from its first `---` to the end. */
function referenceExample(text: string): string {
	const section = text.indexOf("SECTION 8 —");
	const start = text.indexOf("\n---\n", section);
	if (section === -1 || start === -1) return "";
	return text.slice(start + 1);
}

/** The `key: value` lines between the two `---` of a snippet that opens with one. */
function writtenFrontmatter(source: string): string[] | null {
	const lines = source.split("\n");
	if (lines[0] !== "---") return null;
	const end = lines.indexOf("---", 1);
	return end === -1 ? null : lines.slice(1, end);
}

/** The text of every ✅ line, up to a `→` if any (only its first line). */
function approvedLines(block: string): string[] {
	return block
		.split("\n")
		.filter((line) => line.includes("✅"))
		.map((line) => {
			const text = line.slice(line.indexOf("✅") + 1);
			const arrow = text.indexOf("→");
			return (arrow === -1 ? text : text.slice(0, arrow)).trim();
		})
		.filter((text) => text !== "");
}

/** The codes of severity `warning` or `error` a source compiles with, minus the tolerated ones. */
function faults(source: string, tolerated: WarningCode[] = []): string[] {
	return compile(getAST(source))
		.warnings.map((w) => w.code)
		.filter(
			(code) =>
				warningSeverity[code as WarningCode] !== "info" &&
				!tolerated.includes(code as WarningCode),
		);
}

const BLOCKS = fences(GRAM_SPEC_PROMPT);
const REFERENCE = referenceExample(GRAM_SPEC_PROMPT);
const FULL = [
	...BLOCKS.filter((b) => !b.includes("❌") && writtenFrontmatter(b) !== null),
	REFERENCE,
];
const SNIPPETS = BLOCKS.filter(
	(b) => !b.includes("❌") && writtenFrontmatter(b) === null,
);
const COUNTER = BLOCKS.filter((b) => b.includes("❌"));
const APPROVED = COUNTER.flatMap(approvedLines);

const label = (source: string) => JSON.stringify(source.slice(0, 50));

describe("examples of gram import's prompt (gram-spec.ts)", () => {
	it("extracts every kind of example", () => {
		expect(BLOCKS.length).toBeGreaterThanOrEqual(25);
		expect(REFERENCE).toContain("title: 'Lemon Meringue Pie'");
		expect(FULL.length).toBeGreaterThanOrEqual(2);
		expect(SNIPPETS.length).toBeGreaterThanOrEqual(10);
		expect(COUNTER.length).toBeGreaterThanOrEqual(8);
		expect(APPROVED.length).toBeGreaterThanOrEqual(10);
	});

	it("names every deprecated frontmatter key, so the AI never writes one", () => {
		const deprecated = FRONTMATTER_KEYS.filter((def) => def.deprecated);
		expect(deprecated.length).toBeGreaterThan(0);
		const unnamed = deprecated
			.map((def) => def.key)
			.filter((key) => !GRAM_SPEC_PROMPT.includes(`"${key}"`));
		expect(unnamed).toEqual([]);
	});

	for (const source of FULL) {
		it(`full recipe ${label(source)} compiles with no warning`, () => {
			expect(faults(source)).toEqual([]);
		});

		it(`full recipe ${label(source)}: every written key is read, none deprecated, with no comment in its value`, () => {
			const lines = writtenFrontmatter(source) ?? [];
			expect(lines.length).toBeGreaterThan(0);
			for (const line of lines) expect(line).toMatch(/^[A-Za-z]\w*: \S/);
			const meta = getAST(source).meta ?? {};
			const keys = lines.map((line) => line.slice(0, line.indexOf(":")));
			expect(Object.keys(meta).sort()).toEqual([...keys].sort());
			const withComment = Object.entries(meta).filter(([, value]) =>
				JSON.stringify(value).includes("#"),
			);
			expect(withComment).toEqual([]);
			expect(deprecatedFrontmatterKeysIn(meta)).toEqual([]);
		});
	}

	for (const source of SNIPPETS) {
		it(`snippet ${label(source)} compiles with no warning but undefined references`, () => {
			expect(faults(source, [WarningCode.UNDEFINED_REFERENCE])).toEqual([]);
		});
	}

	for (const line of APPROVED) {
		it(`✅ ${label(line)} compiles with no warning but undefined references`, () => {
			expect(faults(`${line}\n`, [WarningCode.UNDEFINED_REFERENCE])).toEqual(
				[],
			);
		});
	}
});
