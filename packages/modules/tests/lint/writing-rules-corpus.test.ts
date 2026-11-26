import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAST } from "@gram-lang/parser";
import { lintText } from "./lint-helpers";

// The writing rules must stay silent on every recipe the repository holds up
// as correct: the kitchen fixtures, the conformance cases that parse, the
// docs' example recipes and every ```gram fence of the docs pages (but the
// ❌ / ✅ blocks, which show mistakes on purpose). This is
// what the thresholds of SUSPECT_INGREDIENT_NAME are tuned against.
const WRITING_CODES = new Set([
	"LOST_INGREDIENT",
	"MERGED_STEP_LINE",
	"SUSPECT_INGREDIENT_NAME",
	"UNREAD_FRONTMATTER",
]);

const REPO = join(import.meta.dir, "../../../..");

function files(dir: string, ext: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? files(join(dir, e.name), ext)
			: e.name.endsWith(ext)
				? [join(dir, e.name)]
				: [],
	);
}

/** Every ```gram fence of a docs page, its indentation (inside a tab) removed. */
function fences(page: string): string[] {
	const text = readFileSync(page, "utf8");
	const found: string[] = [];
	for (const m of text.matchAll(/^([ \t]*)```gram[^\n]*\n([\s\S]*?)^\1```/gm)) {
		const indent = m[1]!.length;
		found.push(
			m[2]!
				.split("\n")
				.map((l) => l.slice(Math.min(indent, l.length - l.trimStart().length)))
				.join("\n"),
		);
	}
	return found;
}

function corpus(): { id: string; text: string }[] {
	const out: { id: string; text: string }[] = [];
	for (const f of [
		...files(join(REPO, "packages/kitchen/tests/fixtures/valid"), ".gram"),
		...files(join(REPO, "conformance/cases"), ".gram"),
		...files(join(REPO, "packages/docs/public/examples"), ".gram"),
	]) {
		out.push({ id: f, text: readFileSync(f, "utf8") });
	}
	for (const page of files(
		join(REPO, "packages/docs/src/content/docs"),
		".mdx",
	)) {
		fences(page).forEach((text, i) => {
			// A ❌ / ✅ block shows mistakes on purpose (`ai-generation-notes.mdx`).
			if (!text.includes("❌")) out.push({ id: `${page}#${i}`, text });
		});
	}
	return out;
}

describe("the writing rules over the repository's recipes", () => {
	it("raise nothing", () => {
		const recipes = corpus();
		expect(recipes.length).toBeGreaterThan(300);
		const raised: string[] = [];
		for (const { id, text } of recipes) {
			try {
				getAST(text);
			} catch {
				continue; // an expected parse failure (`error.json`), or a fragment
			}
			for (const d of lintText(text)) {
				if (WRITING_CODES.has(d.code)) raised.push(`${d.code} ${id}`);
			}
		}
		expect(raised).toEqual([]);
	});
});
