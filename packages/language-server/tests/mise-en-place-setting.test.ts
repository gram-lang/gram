import { describe, expect, it } from "bun:test";
import { DEFAULT_MISE_EN_PLACE_MODE } from "@gram-lang/kitchen";
import { parseMiseEnPlaceSetting } from "../src/utils/mise-en-place-setting";

describe("parseMiseEnPlaceSetting", () => {
	it("defaults to preparing right before each section", () => {
		expect(DEFAULT_MISE_EN_PLACE_MODE).toBe("perSection");
	});

	it("reads both known values", () => {
		expect(parseMiseEnPlaceSetting({ miseEnPlace: "perSection" })).toBe(
			"perSection",
		);
		expect(parseMiseEnPlaceSetting({ miseEnPlace: "upfront" })).toBe("upfront");
	});

	it("falls back to the default for anything else, so a bad setting never blanks the preview", () => {
		for (const bad of [
			undefined,
			null,
			{},
			{ miseEnPlace: "" },
			{ miseEnPlace: "UPFRONT" },
			{ miseEnPlace: "global" },
			{ miseEnPlace: 1 },
			"upfront",
		]) {
			expect(parseMiseEnPlaceSetting(bad)).toBe("perSection");
		}
	});
});
