import { describe, expect, it } from "bun:test";
import { getAST } from "../src/index";

/** The element of a one-step recipe whose step is `step`. */
const element = (step: string, index = 1) =>
	(getAST(`## S\n\n${step}\n`).children[0] as any).children[0].children[index];

describe("a number with no value is kept as written (`invalidNumber`)", () => {
	it("on an ingredient's quantity", () => {
		const q = element("Add @flour{1/0 cups}.").quantity;
		expect(q.value).toBeNull();
		expect(q.unit).toBe("cups");
		expect(q.invalidNumber).toBe("1/0");
	});

	it("for a mixed fraction over zero, which no longer gives Infinity", () => {
		const q = element("Add @flour{1 1/0 cup}.").quantity;
		expect(q.value).toBeNull();
		expect(q.invalidNumber).toBe("1 1/0");
	});

	it("for a range, a term of a sum, a percentage, cookware and a temperature", () => {
		expect(element("Add @flour{1/0-2 cup}.").quantity.invalidNumber).toBe(
			"1/0-2",
		);
		const sum = element("Add @flour{1/0 cup + 1 tbsp}.").quantity;
		expect(sum.terms[0].invalidNumber).toBe("1/0");
		expect(sum.terms[1].invalidNumber).toBeUndefined();
		expect(element("Add @salt{1/0% @&flour}.").quantity.invalidNumber).toBe(
			"1/0",
		);
		expect(element("Use #pan{1/0}.").quantity.invalidNumber).toBe("1/0");
		expect(element("Heat ^{1/0 °C}.").invalidNumber).toBe("1/0");
	});

	it("is left out of every valid quantity", () => {
		const q = element("Add @flour{1/2 cup}.").quantity;
		expect("invalidNumber" in q).toBe(false);
		expect("invalidNumber" in element("Add @salt{une pincée}.").quantity).toBe(
			false,
		);
	});
});
