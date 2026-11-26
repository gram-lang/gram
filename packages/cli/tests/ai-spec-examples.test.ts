import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAST } from "@gram-lang/parser";
import { GRAM_SPEC_PROMPT } from "../src/prompts/gram-spec";

// The frontmatter has no comments: a `# …` line (or an indented one) makes the
// whole block fall back to a text step, and a trailing `# …` becomes part of
// the value. The examples the AI copies (`gram import`'s prompt, the
// gram-authoring skill) once had both, so every frontmatter they show must be
// read back key for key, with no `#` in any value.

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
// `.agents/` and `.claude/` are git-ignored: the skill lives only in a
// maintainer's checkout, so CI checks gram-spec.ts alone and skips the rest.
const SKILL_FILES = [
	".agents/skills/gram-authoring/SKILL.md",
	".claude/skills/gram-authoring/SKILL.md",
];
const HAS_SKILL = SKILL_FILES.every((f) => existsSync(join(REPO_ROOT, f)));

/** The body of every fence that opens at column 0 with ``` (any language). */
function fences(text: string, lang?: string): string[] {
	const bodies: string[] = [];
	let buffer: string[] | null = null;
	for (const line of text.split("\n")) {
		if (buffer === null) {
			if (
				line.startsWith("```") &&
				(lang === undefined || line === `\`\`\`${lang}`)
			)
				buffer = [];
		} else if (line === "```") {
			bodies.push(`${buffer.join("\n")}\n`);
			buffer = null;
		} else {
			buffer.push(line);
		}
	}
	return bodies;
}

/** The `key: value` lines between the two `---` of a snippet that opens with one. */
function writtenFrontmatter(source: string): string[] | null {
	const lines = source.split("\n");
	if (lines[0] !== "---") return null;
	const end = lines.indexOf("---", 1);
	return end === -1 ? null : lines.slice(1, end);
}

function frontmatterExamples(): { origin: string; source: string }[] {
	const examples = fences(GRAM_SPEC_PROMPT)
		.filter((body) => writtenFrontmatter(body) !== null)
		.map((source) => ({ origin: "gram-spec.ts", source }));
	for (const file of HAS_SKILL ? SKILL_FILES : []) {
		const text = readFileSync(join(REPO_ROOT, file), "utf8");
		for (const source of fences(text, "gram"))
			if (writtenFrontmatter(source) !== null)
				examples.push({ origin: file, source });
	}
	return examples;
}

describe("frontmatter examples of the AI specs", () => {
	const examples = frontmatterExamples();

	it("finds one in gram-spec.ts and one in each SKILL.md", () => {
		expect(examples.map((e) => e.origin).sort()).toEqual(
			["gram-spec.ts", ...(HAS_SKILL ? SKILL_FILES : [])].sort(),
		);
	});

	it.skipIf(!HAS_SKILL)("keeps the two SKILL.md mirrors identical", () => {
		const [agents, claude] = SKILL_FILES.map((f) =>
			readFileSync(join(REPO_ROOT, f), "utf8"),
		);
		expect(claude).toBe(agents);
	});

	for (const { origin, source } of examples) {
		it(`${origin}: every written key is read, with no comment in its value`, () => {
			const lines = writtenFrontmatter(source) ?? [];
			for (const line of lines) expect(line).toMatch(/^[A-Za-z]\w*: \S/);
			const meta = getAST(source).meta ?? {};
			const keys = lines.map((line) => line.slice(0, line.indexOf(":")));
			expect(Object.keys(meta).sort()).toEqual([...keys].sort());
			const withComment = Object.entries(meta).filter(([, value]) =>
				JSON.stringify(value).includes("#"),
			);
			expect(withComment).toEqual([]);
		});
	}
});
