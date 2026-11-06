import { describe, expect, it, spyOn } from "bun:test";
import { SETTINGS, VIEW_SETTINGS } from "@gram-lang/renderer";
import {
	flagDefault,
	flagValues,
	parseChoiceFlag,
	toFlagValue,
} from "../src/services/setting-flags";

describe("toFlagValue", () => {
	it("writes the values in kebab-case", () => {
		expect(toFlagValue("perSection")).toBe("per-section");
		expect(toFlagValue("perPortion")).toBe("per-portion");
		expect(toFlagValue("per100g")).toBe("per-100g");
		expect(toFlagValue("upfront")).toBe("upfront");
	});

	it("keeps every value of every setting distinct once written", () => {
		for (const setting of SETTINGS) {
			if (setting.type !== "choice") continue;
			const written = flagValues(setting);
			expect(new Set(written).size).toBe(setting.values.length);
		}
	});
});

describe("parseChoiceFlag", () => {
	it("reads the CLI spelling back to the setting's value", () => {
		const setting = VIEW_SETTINGS.nutritionBasis;
		for (const value of setting.values) {
			expect(parseChoiceFlag(setting, "nutrition", toFlagValue(value))).toBe(
				value,
			);
		}
		expect(flagDefault(setting)).toBe("auto");
	});

	it("leaves an absent flag unset", () => {
		for (const value of [undefined, null, ""]) {
			expect(
				parseChoiceFlag(VIEW_SETTINGS.rests, "rests", value),
			).toBeUndefined();
		}
	});

	it("reports and exits on a value it does not know, the camelCase one included", () => {
		const exit = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);
		const out = spyOn(process.stdout, "write").mockImplementation(() => true);
		try {
			expect(() =>
				parseChoiceFlag(VIEW_SETTINGS.nutritionBasis, "nutrition", "per100g"),
			).toThrow("exit");
			expect(() =>
				parseChoiceFlag(VIEW_SETTINGS.comments, "comments", "maybe"),
			).toThrow("exit");
		} finally {
			exit.mockRestore();
			out.mockRestore();
		}
	});
});
