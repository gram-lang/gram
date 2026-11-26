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

	// The suggestion quotes the source spelling, which rule 4 canonicalizes;
	// nothing else in it may differ.
	it("compares an INVALID_DURATION suggestion up to its trailing zeros only", () => {
		const warning = (suggestion: string) => ({
			code: "INVALID_DURATION",
			data: { suggestion },
		});
		const same = (a: string, b: string) =>
			firstDifference(normalize(warning(a)), normalize(warning(b)));
		expect(same("1.30 h", "1.3 h")).toBeNull();
		expect(same("2.0-3.50 min", "2-3.5 min")).toBeNull();
		expect(same("1.30 h", "1.3 min")).toBe("$.data.suggestion");
		expect(same("1.30 h", "13 h")).toBe("$.data.suggestion");
		// A fraction's terms keep their zeros (#286), and so does `1,000`.
		expect(same("1/5.0 h", "1/5 h")).toBe("$.data.suggestion");
		expect(same("1,000 h", "1 h")).toBe("$.data.suggestion");
		// Another code's suggestion is still compared as written.
		expect(
			firstDifference(
				normalize({ code: "OTHER", data: { suggestion: "1.30 h" } }),
				normalize({ code: "OTHER", data: { suggestion: "1.3 h" } }),
			),
		).toBe("$.data.suggestion");
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
