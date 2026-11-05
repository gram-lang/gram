import { describe, expect, it } from "bun:test";
import { getDictionary } from "@gram-lang/i18n";
import { describeError } from "../src/index";

const warning = {
	code: "UNUSED_INGREDIENT",
	message: "flour is never used",
	severity: "warning" as const,
	blocking: false,
	loc: { start: 4, end: 9 },
};
const scale = {
	code: "SCALE_ERROR",
	message: "no such ingredient",
	severity: "error" as const,
	blocking: false,
};
const parse = {
	code: "PARSE_ERROR",
	message: "Expected a step",
	severity: "error" as const,
	blocking: true,
	loc: { start: 40, end: 41, uri: "/bases/dough.gram" },
	uri: "/bases/dough.gram",
};

describe("describeError", () => {
	it("is null with no diagnostic", () => {
		expect(describeError([])).toBeNull();
	});

	it("picks the blocking error first, wherever it is", () => {
		const error = describeError([warning, scale, parse])!;
		expect(error.diagnostic).toBe(parse);
		expect(error.code).toBe("PARSE_ERROR");
		expect(error.message).toBe("Expected a step");
	});

	it("then the first error, then the first diagnostic", () => {
		expect(describeError([warning, scale])!.diagnostic).toBe(scale);
		expect(describeError([warning])!.diagnostic).toBe(warning);
	});

	it("says which module and where, in offsets", () => {
		const error = describeError([parse])!;
		expect(error.uri).toBe("/bases/dough.gram");
		expect(error.range).toEqual({ start: 40, end: 41 });
		expect(describeError([scale])!.range).toBeUndefined();
	});

	it("words what happened to the views in the language asked for", () => {
		const fr = describeError([parse], "fr")!;
		expect(fr.title).toBe(getDictionary("fr").renderer.viewsPaused);
		expect(fr.title).toBe("Génération interrompue");
		expect(describeError([parse])!.title).toBe("Generation paused");
		expect(fr.description).toBe(
			getDictionary("fr").playground.errorState.blockingDescription,
		);
	});
});
