import { describe, expect, it } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideHover } from "../src/features/hover";

const NBSP = " ";

/** The hover text one character into the first occurrence of `needle`. */
function hoverAt(text: string, needle: string): string | null {
	const state = parseDocument(text);
	const before = text.slice(0, text.indexOf(needle) + 1).split("\n");
	const hover = provideHover(
		state,
		{ line: before.length - 1, character: before[before.length - 1]!.length },
		{},
	);
	return hover ? (hover.contents as { value: string }).value : null;
}

describe("hover on a section anchor", () => {
	it("shows the anticipation and says an anchor in days opens a working day", () => {
		const value = hoverAt(
			"## Brioche ~{-1d 12h}\n\nKnead.\n\n## Serve\n\nServe.\n",
			"~{",
		);
		expect(value).toContain("`~{-1d 12h}`");
		expect(value).toContain(`1${NBSP}d 12${NBSP}h`);
		expect(value).toContain("working day");
	});

	it("keeps an anchor in hours in hours, as a deadline within the day", () => {
		const value = hoverAt(
			"## Dough ~{-36h}\n\nKnead.\n\n## Serve\n\nServe.\n",
			"~{",
		);
		expect(value).toContain(`36${NBSP}h`);
		expect(value).toContain("within the day");
	});

	it("speaks the recipe's language", () => {
		const value = hoverAt(
			"---\nlanguage: fr\n---\n\n## Ganache ~{-1h30}\n\nVerser.\n\n## Service\n\nServir.\n",
			"~{",
		);
		expect(value).toContain(`1${NBSP}h 30${NBSP}min`);
		expect(value).toContain("journée");
	});

	it("works on the anchor of a @use directive", () => {
		const value = hoverAt(
			'@use "./levain.gram" as &levain ~{-2d}\n\n## Pain\n\nMix the &levain{200g}.\n',
			"~{",
		);
		expect(value).toContain(`2${NBSP}d`);
	});

	it("says nothing about an anchor Gram refuses, or off the anchor", () => {
		expect(hoverAt("## Dough ~{-1:30}\n\nKnead.\n", "~{")).toBeNull();
		expect(hoverAt("## Dough ~{2h}\n\nKnead.\n", "~{")).toBeNull();
		expect(hoverAt("## Dough ~{-2h}\n\nKnead.\n", "Dough")).toBeNull();
	});
});
