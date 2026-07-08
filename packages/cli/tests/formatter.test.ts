import { describe, it, expect } from "bun:test";
import {
	formatGram,
	hasChanges,
	summarizeChanges,
} from "../src/services/formatter";

describe("formatGram", () => {
	it("lowercases ingredient IDs", () => {
		const { content, changes } = formatGram("Add @Farine{200g}.\n");
		expect(content).toBe("Add @farine{200g}.\n");
		expect(changes.lowercasedIds).toBe(1);
	});

	it("removes space between @id and opening brace", () => {
		const { content, changes } = formatGram("Add @flour {200g}.\n");
		expect(content).toBe("Add @flour{200g}.\n");
		expect(changes.spacesBeforeBrace).toBe(1);
	});

	it("trims spaces inside braces", () => {
		const { content, changes } = formatGram("Add @flour{ 200g }.\n");
		expect(content).toBe("Add @flour{200g}.\n");
		expect(changes.spacesInsideBraces).toBe(1);
	});

	it("removes trailing decimal zeros", () => {
		const { content, changes } = formatGram(
			"Add @flour{500.0g} and @egg{1.50}.\n",
		);
		expect(content).toBe("Add @flour{500g} and @egg{1.5}.\n");
		expect(changes.trailingZeros).toBe(2);
	});

	it("does not touch quantities without trailing zeros", () => {
		const { content, changes } = formatGram(
			"Add @flour{500g} and @egg{1.25}.\n",
		);
		expect(content).toBe("Add @flour{500g} and @egg{1.25}.\n");
		expect(changes.trailingZeros).toBe(0);
	});

	it("removes space before ° in temperature quantities", () => {
		const { content, changes } = formatGram("Bake at ~temp{180 °C}.\n");
		expect(content).toBe("Bake at ~temp{180°C}.\n");
		expect(changes.temperatureSpacing).toBe(1);
	});

	it("handles multiple temperatures in the same brace", () => {
		const { content, changes } = formatGram("Range ~temp{180 °C-200 °F}.\n");
		expect(content).toBe("Range ~temp{180°C-200°F}.\n");
		expect(changes.temperatureSpacing).toBe(2);
	});

	it("trims trailing whitespace line by line", () => {
		const { content, changes } = formatGram("## Section   \nStep one.  \n");
		expect(content).toBe("## Section\nStep one.\n");
		expect(changes.trailingWhitespace).toBe(2);
	});

	it("collapses 4+ consecutive newlines to 3 (max 2 blank lines)", () => {
		const { content, changes } = formatGram("Line one.\n\n\n\n\nLine two.\n");
		expect(content).toBe("Line one.\n\n\nLine two.\n");
		expect(changes.consecutiveBlankLines).toBe(1);
	});

	it("does not touch exactly 2 blank lines (3 newlines)", () => {
		const { content, changes } = formatGram("Line one.\n\n\nLine two.\n");
		expect(content).toBe("Line one.\n\n\nLine two.\n");
		expect(changes.consecutiveBlankLines).toBe(0);
	});

	it("promotes single blank line to 2 blank lines before a section header", () => {
		const { content, changes } = formatGram("Intro.\n\n## Section\nStep.\n");
		expect(content).toBe("Intro.\n\n\n## Section\nStep.\n");
		expect(changes.sectionSpacing).toBe(1);
	});

	it("does not re-promote a section header that already has 2 blank lines", () => {
		const { content, changes } = formatGram("Intro.\n\n\n## Section\nStep.\n");
		expect(content).toBe("Intro.\n\n\n## Section\nStep.\n");
		expect(changes.sectionSpacing).toBe(0);
	});

	it("does not promote spacing before a sub-section header (###)", () => {
		const { content, changes } = formatGram("Intro.\n\n### Sub\nStep.\n");
		expect(content).toBe("Intro.\n\n### Sub\nStep.\n");
		expect(changes.sectionSpacing).toBe(0);
	});

	it("ensures a single newline at EOF when missing", () => {
		const { content, changes } = formatGram("Step one.");
		expect(content).toBe("Step one.\n");
		expect(changes.eofNewline).toBe(true);
	});

	it("collapses multiple trailing newlines at EOF to exactly one", () => {
		const { content, changes } = formatGram("Step one.\n\n\n");
		expect(content).toBe("Step one.\n");
		expect(changes.eofNewline).toBe(true);
	});

	it("reports no changes for already-clean content", () => {
		const clean = "## Section\n\n\nAdd @flour{200g}.\n";
		const { content, changes } = formatGram(clean);
		expect(content).toBe(clean);
		expect(hasChanges(changes)).toBe(false);
	});

	it("is idempotent: formatting already-formatted output produces no further changes", () => {
		const messy =
			"##   Prep  \nAdd @Flour {500.0g} and @Egg{ 1.50 }.  \n\n\n\n\n## Bake\nSet oven to ~temp{180 °C}.";
		const first = formatGram(messy);
		const second = formatGram(first.content);
		expect(second.content).toBe(first.content);
		expect(hasChanges(second.changes)).toBe(false);
	});
});

describe("hasChanges", () => {
	const empty = {
		lowercasedIds: 0,
		spacesBeforeBrace: 0,
		spacesInsideBraces: 0,
		trailingZeros: 0,
		temperatureSpacing: 0,
		consecutiveBlankLines: 0,
		sectionSpacing: 0,
		trailingWhitespace: 0,
		eofNewline: false,
	};

	it("is false when nothing changed", () => {
		expect(hasChanges(empty)).toBe(false);
	});

	it("is true when only the boolean eofNewline flag is set", () => {
		expect(hasChanges({ ...empty, eofNewline: true })).toBe(true);
	});

	it("is true when any numeric counter is non-zero", () => {
		expect(hasChanges({ ...empty, lowercasedIds: 1 })).toBe(true);
	});
});

describe("summarizeChanges", () => {
	it("returns an empty string when nothing changed", () => {
		const empty = {
			lowercasedIds: 0,
			spacesBeforeBrace: 0,
			spacesInsideBraces: 0,
			trailingZeros: 0,
			temperatureSpacing: 0,
			consecutiveBlankLines: 0,
			sectionSpacing: 0,
			trailingWhitespace: 0,
			eofNewline: false,
		};
		expect(summarizeChanges(empty)).toBe("");
	});

	it("pluralizes counts correctly", () => {
		const changes = {
			lowercasedIds: 2,
			spacesBeforeBrace: 1,
			spacesInsideBraces: 0,
			trailingZeros: 0,
			temperatureSpacing: 0,
			consecutiveBlankLines: 0,
			sectionSpacing: 0,
			trailingWhitespace: 0,
			eofNewline: false,
		};
		const summary = summarizeChanges(changes);
		expect(summary).toContain("2 IDs lowercased");
		expect(summary).toContain("1 space before brace removed");
	});
});
