import { describe, it, expect } from "bun:test";
import { getAiLanguageInstruction } from "../src/ai";

describe("getAiLanguageInstruction", () => {
	it("names the requested language", () => {
		expect(getAiLanguageInstruction("fr")).toContain("French");
		expect(getAiLanguageInstruction("ja")).toContain("Japanese");
	});

	it("defaults to English when no language is given", () => {
		expect(getAiLanguageInstruction()).toContain("English");
	});

	it("falls back to the raw language code when it isn't in the known list", () => {
		expect(getAiLanguageInstruction("xx")).toContain("xx");
	});
});
