import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { collectShapes } from "../src/vocabulary";

const shapes = (source: string) => [...collectShapes(getAST(source))].sort();

describe("collectShapes: how durations are written", () => {
	it("tells a compound, a clock, primes and a range apart", () => {
		expect(shapes("Bake ~{10 min}.\n")).not.toContain("Timer:compound");
		expect(shapes("Bake ~{1h30}.\n")).toContain("Timer:compound");
		expect(shapes("Bake ~{1h30}.\n")).toContain("Timer:form=units");
		expect(shapes("Bake ~{1:30 h}.\n")).toContain("Timer:form=clock");
		expect(shapes(`Cook ~{5'30"}.\n`)).toContain("Timer:form=prime");
		expect(shapes("Roast ~{45 min - 1 h}.\n")).toContain("Timer:range");
	});

	it("reads a section anchor without its sign", () => {
		const anchor = shapes("## Dough ~{-1h30}\n\nMix.\n");
		expect(anchor).toContain("Section:retroPlanning:compound");
		expect(anchor).toContain("Section:retroPlanning:form=units");
	});

	it("adds nothing for a duration Gram refuses", () => {
		expect(shapes("Bake ~{1:30}.\n").filter((s) => s.includes("form="))).toEqual([]);
	});
});

describe("collectShapes: sums of quantities", () => {
	it("tells a sum, a subtraction and several kinds of amount apart", () => {
		const plain = shapes("## S\n\nAdd @flour{1 cup + 1 tbsp}.\n");
		expect(plain).toContain("Ingredient:quantity=compound");
		expect(plain).not.toContain("Ingredient:quantity=compound:minus");
		expect(plain).not.toContain("Ingredient:quantity=compound:mixedFamily");
		expect(shapes("## S\n\nAdd @sugar{1 cup - 2 tbsp}.\n")).toContain(
			"Ingredient:quantity=compound:minus",
		);
		expect(shapes("## S\n\nAdd @flour{1 cup + 20 g}.\n")).toContain(
			"Ingredient:quantity=compound:mixedFamily",
		);
	});

	it("adds nothing for a plain quantity", () => {
		expect(shapes("## S\n\nAdd @flour{200 g}.\n").filter((s) => s.includes("compound"))).toEqual([]);
	});
});
