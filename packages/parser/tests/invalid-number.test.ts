import { describe, expect, it } from "bun:test";
import {
	type ASTNode,
	getAST,
	isCompoundQuantity,
	isCookware,
	isIngredient,
	isQuantity,
	isRelativeQuantity,
	isSection,
	isStep,
	isTemperature,
	type TemperatureAST,
} from "../src/index";

/** The element right after the first text of a one-step recipe whose step is `step`. */
function element(step: string): ASTNode {
	const section = getAST(`## S\n\n${step}\n`).children[0];
	if (!isSection(section)) throw new Error("expected a section");
	const block = section.children[0];
	if (!isStep(block)) throw new Error("expected a step");
	const node = block.children[1];
	if (!node) throw new Error("expected an element");
	return node;
}

/** The `{…}` of the ingredient or cookware of `step`. */
function quantityOf(step: string) {
	const node = element(step);
	if (!isIngredient(node) && !isCookware(node))
		throw new Error("expected an ingredient or cookware");
	return node.quantity;
}

/** The plain quantity (`QuantityAST`) of `step`. */
function plain(step: string) {
	const q = quantityOf(step);
	if (!isQuantity(q)) throw new Error("expected a plain quantity");
	return q;
}

function temperature(step: string): TemperatureAST {
	const node = element(step);
	if (!isTemperature(node)) throw new Error("expected a temperature");
	return node;
}

describe("a number with no value is kept as written (`invalidNumber`)", () => {
	it("on an ingredient's quantity", () => {
		const q = plain("Add @flour{1/0 cups}.");
		expect(q.value).toBeNull();
		expect(q.unit).toBe("cups");
		expect(q.invalidNumber).toBe("1/0");
	});

	it("for a mixed fraction over zero, which no longer gives Infinity", () => {
		const q = plain("Add @flour{1 1/0 cup}.");
		expect(q.value).toBeNull();
		expect(q.invalidNumber).toBe("1 1/0");
	});

	it("for a range, a term of a sum, a percentage, cookware and a temperature", () => {
		expect(plain("Add @flour{1/0-2 cup}.").invalidNumber).toBe("1/0-2");

		const sum = quantityOf("Add @flour{1/0 cup + 1 tbsp}.");
		if (!isCompoundQuantity(sum)) throw new Error("expected a sum");
		expect(sum.terms[0]?.invalidNumber).toBe("1/0");
		expect(sum.terms[1]?.invalidNumber).toBeUndefined();

		const relative = quantityOf("Add @salt{1/0% @&flour}.");
		if (!isRelativeQuantity(relative))
			throw new Error("expected a relative quantity");
		expect(relative.invalidNumber).toBe("1/0");

		expect(plain("Use #pan{1/0}.").invalidNumber).toBe("1/0");
		expect(temperature("Heat ^{1/0 °C}.").invalidNumber).toBe("1/0");
	});

	it("is left out of every valid quantity", () => {
		expect("invalidNumber" in plain("Add @flour{1/2 cup}.")).toBe(false);
		expect("invalidNumber" in plain("Add @salt{une pincée}.")).toBe(false);
	});
});
