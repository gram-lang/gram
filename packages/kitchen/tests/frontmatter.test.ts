import { describe, expect, it } from "bun:test";
import { getDictionary } from "@gram-lang/i18n";
import { getAST } from "@gram-lang/parser";
import {
	canonicalFrontmatterKeys,
	FRONTMATTER_KEYS,
	frontmatterKey,
} from "../src/frontmatter";
import { compile } from "../src/index";
import { WarningCode, warningSeverity } from "../src/warnings";

const deprecatedWarnings = (frontmatter: string) =>
	compile(
		getAST(`---\n${frontmatter}\n---\n\n[Mix] @flour{200g}.\n`),
	).warnings.filter((w) => w.code === WarningCode.DEPRECATED_FRONTMATTER_KEY);

describe("FRONTMATTER_KEYS", () => {
	it("lists each key once", () => {
		const keys = FRONTMATTER_KEYS.map((def) => def.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("points every deprecated key to a canonical one", () => {
		for (const def of FRONTMATTER_KEYS) {
			if (!def.deprecated) continue;
			const target = frontmatterKey(def.deprecated.replacement);
			expect(target, def.key).toBeDefined();
			expect(target?.deprecated, def.key).toBeUndefined();
		}
	});

	it("deprecates exactly servings, yield and yields", () => {
		expect(
			FRONTMATTER_KEYS.filter((def) => def.deprecated).map((def) => [
				def.key,
				def.deprecated?.replacement,
			]),
		).toEqual([
			["servings", "portions"],
			["yield", "makes"],
			["yields", "makes"],
		]);
		expect(canonicalFrontmatterKeys().map((def) => def.key)).not.toContain(
			"servings",
		);
	});

	it("gives every key and value kind its words in en and fr", () => {
		for (const lang of ["en", "fr"]) {
			const t = getDictionary(lang).frontmatter;
			for (const def of FRONTMATTER_KEYS) {
				expect(t.keys[def.key], `${lang} ${def.key}`).toBeString();
				expect(t.values[def.value], `${lang} ${def.value}`).toBeString();
			}
		}
	});

	it("writes each example as a line of its own key", () => {
		for (const def of FRONTMATTER_KEYS) {
			expect(def.example.startsWith(`${def.key}: `), def.key).toBeTrue();
			const meta = getAST(`---\n${def.example}\n---\n\nStep.\n`).meta;
			expect(meta[def.key], def.key).toBeDefined();
		}
	});
});

describe("DEPRECATED_FRONTMATTER_KEY", () => {
	it("warns on each deprecated key, with the key to write instead", () => {
		const warnings = deprecatedWarnings(
			"title: T\nservings: 4\nyield: 1 cake\nyields: 2 cakes",
		);
		expect(warnings.map((w) => w.data)).toEqual([
			{ key: "servings", suggestion: "portions" },
			{ key: "yield", suggestion: "makes" },
			{ key: "yields", suggestion: "makes" },
		]);
		expect(warnings[0]?.message).toBe(
			'Frontmatter key "servings" is deprecated and will be removed in 2.0.0: write "portions" instead.',
		);
		// No position: the AST does not keep where a frontmatter key was written.
		expect(warnings.every((w) => w.loc === undefined)).toBeTrue();
	});

	it("still warns when the canonical key is written too, which wins", () => {
		const source =
			"---\nportions: 2\nservings: 4\n---\n\n[Mix] @flour{200g}.\n";
		const compiled = compile(getAST(source));
		expect(
			compiled.warnings.filter(
				(w) => w.code === WarningCode.DEPRECATED_FRONTMATTER_KEY,
			),
		).toHaveLength(1);
		expect(compiled.meta.portions).toBe("2");
		expect(compiled.meta.servings).toBe("4");
	});

	it("says nothing about canonical or custom keys", () => {
		expect(
			deprecatedWarnings(
				"title: T\nportions: 4\nmakes: 1 cake\nlanguage: fr\ndifficulty: easy",
			),
		).toEqual([]);
	});

	it("is a warning, so --strict fails on it", () => {
		expect(warningSeverity[WarningCode.DEPRECATED_FRONTMATTER_KEY]).toBe(
			"warning",
		);
	});
});
