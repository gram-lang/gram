import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error: plain CommonJS build script, no type declarations
import { tmJsonToPlist, UUID } from "../scripts/tm-plist.cjs";

const syntaxes = join(import.meta.dir, "../syntaxes");
const json = JSON.parse(
	readFileSync(join(syntaxes, "gram.tmLanguage.json"), "utf-8"),
);
const plist: string = tmJsonToPlist(json);

describe("TextMate plist for Sublime Text", () => {
	test("the committed gram.tmLanguage is up to date with the JSON grammar", () => {
		expect(readFileSync(join(syntaxes, "gram.tmLanguage"), "utf-8")).toBe(
			plist,
		);
	});

	test("is deterministic", () => {
		expect(tmJsonToPlist(json)).toBe(plist);
	});

	test("associates .gram files, keeps the scope and a fixed uuid, drops $schema", () => {
		expect(plist).toContain(
			"<key>fileTypes</key>\n\t<array>\n\t\t<string>gram</string>\n\t</array>",
		);
		expect(plist).toContain(
			"<key>scopeName</key>\n\t<string>source.gram</string>",
		);
		expect(plist).toContain(`<key>uuid</key>\n\t<string>${UUID}</string>`);
		expect(plist).not.toContain("$schema");
	});

	test("escapes XML and keeps UTF-8 as is", () => {
		const out: string = tmJsonToPlist({
			name: "T",
			scopeName: "source.t",
			patterns: [{ match: '(?<=a)&<b>"°×¼"' }],
		});
		expect(out).toContain(
			"<string>(?&lt;=a)&amp;&lt;b&gt;&quot;°×¼&quot;</string>",
		);
	});

	test("rejects characters XML cannot carry", () => {
		expect(() =>
			tmJsonToPlist({
				name: "T",
				scopeName: "s",
				patterns: [{ match: "\u0001" }],
			}),
		).toThrow(/control character/);
	});
});
