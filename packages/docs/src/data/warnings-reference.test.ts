import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allDiagnosticInfo, docUrlOf } from "@gram-lang/modules/lint";
import { warningCodesTable } from "./api-reference";

// Every code a diagnostic can carry has its own section on the warnings
// page, in both languages: its `docUrl` (an editor's `codeDescription`
// link) lands on it, and the generated table links to it.
const PAGES = {
	en: "../content/docs/docs/reference/api/warnings.mdx",
	fr: "../content/docs/fr/docs/reference/api/warnings.mdx",
};

describe("warnings reference page", () => {
	for (const [locale, path] of Object.entries(PAGES)) {
		const text = readFileSync(join(import.meta.dir, path), "utf8");
		const headings = new Set(
			[...text.matchAll(/^### `([A-Z0-9_]+)`/gm)].map((m) => m[1]),
		);

		it(`gives every code of allDiagnosticInfo() its section (${locale})`, () => {
			const missing = allDiagnosticInfo()
				.map((i) => i.code)
				.filter((code) => !headings.has(code));
			expect(missing).toEqual([]);
		});

		it(`documents no code that does not exist (${locale})`, () => {
			const codes = new Set(allDiagnosticInfo().map((i) => i.code));
			expect([...headings].filter((h) => !codes.has(h!))).toEqual([]);
		});
	}

	it("links each row of the table to the anchor its docUrl points to", () => {
		const { rows } = warningCodesTable("en");
		expect(rows).toHaveLength(allDiagnosticInfo().length);
		for (const [cell] of rows) {
			const [, code, anchor] = /^\[`([A-Z0-9_]+)`\]\(#([a-z0-9_]+)\)$/.exec(
				cell!,
			)!;
			expect(docUrlOf(code!)).toEndWith(`/warnings/#${anchor}`);
		}
	});
});
