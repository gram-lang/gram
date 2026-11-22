import { describe, expect, it } from "bun:test";
import { parseDocument } from "../src/document-state";
import { provideCodeLenses } from "../src/features/code-lens";

const state = parseDocument("---\ntitle: Tart\n---\n\nMix @flour{200g}.\n");
const title = (locale?: string) =>
	provideCodeLenses(state, locale)[0]?.command?.title;

// The lens is a command of the editor: it speaks the editor's language
// (`InitializeParams.locale`), not the recipe's.
describe("provideCodeLenses", () => {
	it("opens the preview from the top of the recipe", () => {
		const [lens] = provideCodeLenses(state);
		expect(lens?.command?.command).toBe("gram.showPreview");
		expect(lens?.range.start).toEqual({ line: 0, character: 0 });
	});

	it("speaks the editor's language", () => {
		expect(title("en")).toBe("▶ Preview");
		expect(title("fr")).toBe("▶ Aperçu");
		expect(title("fr-CA")).toBe("▶ Aperçu");
	});

	it("falls back to English for an unknown or missing locale", () => {
		expect(title()).toBe("▶ Preview");
		expect(title("de")).toBe("▶ Preview");
	});
});
