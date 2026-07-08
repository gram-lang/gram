import { describe, it, expect } from "bun:test";
import { getDictionary } from "../src/locales";
import { en } from "../src/locales/en";
import { fr } from "../src/locales/fr";

describe("getDictionary", () => {
	it("returns the French dictionary for 'fr'", () => {
		expect(getDictionary("fr")).toBe(fr);
	});

	it("returns the English dictionary for 'en'", () => {
		expect(getDictionary("en")).toBe(en);
	});

	it("extracts the base language from a regional code (e.g. 'fr-FR')", () => {
		expect(getDictionary("fr-FR")).toBe(fr);
	});

	it("defaults to English when no language is given", () => {
		expect(getDictionary()).toBe(en);
	});

	it("falls back to English for an unsupported language", () => {
		expect(getDictionary("de")).toBe(en);
	});

	it("is case-insensitive on the language code", () => {
		expect(getDictionary("FR")).toBe(fr);
	});
});
