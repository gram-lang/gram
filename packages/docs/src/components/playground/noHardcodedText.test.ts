import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every word the playground shows comes from `@gram-lang/i18n`, in both
// languages at once. A `lang === "fr" ? "…" : "…"` is a text that one language
// has and the other forgot (or got wrong), and a `t.key || "fallback"` is a
// fallback that hides a missing key in one of them. This fails on either.

const here = import.meta.dir;
const sources = readdirSync(here).filter(
	(file) =>
		/\.(vue|ts)$/.test(file) && !file.endsWith(".test.ts") && file !== "db.ts",
);

/** A language chosen in the code: the reader's words belong in the dictionary. */
const LANGUAGE_BRANCH =
	/\b(?:lang|Lang|currentLang)(?:\.value)?\s*[!=]==?\s*["'](?:fr|en)["']/;
/** A dictionary entry with a hard-coded text behind it. */
const TEXT_FALLBACK = /\bt(?:\.value)?\.[\w.?]+\s*\|\|\s*(?:["'`(])/;

/** What is allowed to branch on the language, and why. */
const ALLOWED = [
	// Picks which manifest file to fetch: a file name, not a text a reader sees.
	/manifest/,
];

function offenders(pattern: RegExp): string[] {
	return sources.flatMap((file) =>
		readFileSync(join(here, file), "utf-8")
			.split("\n")
			.flatMap((line, i) =>
				pattern.test(line) && !ALLOWED.some((ok) => ok.test(line))
					? [`${file}:${i + 1}: ${line.trim()}`]
					: [],
			),
	);
}

describe("the playground's words", () => {
	it("has files to check", () => {
		expect(sources).toContain("ScheduleSection.vue");
		expect(sources).toContain("GramPlayground.vue");
	});

	it("never choose a text by language in the code", () => {
		expect(offenders(LANGUAGE_BRANCH)).toEqual([]);
	});

	it("never fall back to a text written in the code", () => {
		expect(offenders(TEXT_FALLBACK)).toEqual([]);
	});

	it("catches what it is meant to catch", () => {
		expect(
			LANGUAGE_BRANCH.test(`{{ lang === 'fr' ? 'Effacer' : 'Clear' }}`),
		).toBe(true);
		expect(LANGUAGE_BRANCH.test(`currentLang.value === "fr" ? a : b`)).toBe(
			true,
		);
		expect(LANGUAGE_BRANCH.test(`lang.value !== "en"`)).toBe(true);
		expect(TEXT_FALLBACK.test(`t.playground.mobileTabs?.editor || (x)`)).toBe(
			true,
		);
		expect(
			TEXT_FALLBACK.test(`t.value.playground.resetSection || 'Reset'`),
		).toBe(true);
		expect(LANGUAGE_BRANCH.test(`const lang = ref("fr")`)).toBe(false);
		expect(TEXT_FALLBACK.test(`const t = a || b`)).toBe(false);
	});
});
