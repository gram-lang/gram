import { describe, expect, it } from "bun:test";
import { firstDifference, normalize, pathShape } from "../src/normalize";

describe("normalize", () => {
	it("drops positions and source spellings, keeps meaning", () => {
		const a = {
			loc: { start: 1 },
			qty: { value: 160, text: "160.0" },
			raw: "160.0 g",
			qty2: 3,
		};
		const b = {
			loc: { start: 9 },
			qty: { value: 160, text: "160" },
			raw: "160 g",
			qty2: 3,
		};
		expect(firstDifference(normalize(a), normalize(b))).toBeNull();
		expect(firstDifference(normalize(a), normalize({ ...b, qty2: 4 }))).toBe(
			"$.qty2",
		);
	});

	it("does not trim prose in the middle of a step", () => {
		expect(normalize(["Bake ", { id: "x" }, "now. "])).toEqual([
			"Bake ",
			{ id: "x" },
			"now.",
		]);
	});

	it("blanks indices and keeps the first segments for signatures", () => {
		expect(pathShape("$.sections[3].steps[0].content[2].raw")).toBe(
			"$.sections[].steps[]",
		);
	});
});
