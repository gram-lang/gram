import { describe, it, expect } from "bun:test";
import { compileDictionary } from "../src/dictionary";

describe("compileDictionary", () => {
	const dictionaries = {
		en: { kg: ["kilo", "kilos", "kilogram"] },
		fr: { kg: ["kilo", "kilos", "kilogramme"] },
	};

	it("maps every alias to its canonical unit, per language", () => {
		const { byLang } = compileDictionary(dictionaries);
		expect(byLang.en?.kilogram).toBe("kg");
		expect(byLang.fr?.kilogramme).toBe("kg");
	});

	it("includes the canonical key itself as its own alias", () => {
		const { byLang } = compileDictionary(dictionaries);
		expect(byLang.en?.kg).toBe("kg");
	});

	it("lowercases aliases before indexing them", () => {
		const { byLang } = compileDictionary({ en: { kg: ["KILO"] } });
		expect(byLang.en?.kilo).toBe("kg");
	});

	it("builds a merged global lookup across all languages", () => {
		const { global } = compileDictionary(dictionaries);
		expect(global.kilo).toBe("kg");
		expect(global.kilogramme).toBe("kg");
	});
});
