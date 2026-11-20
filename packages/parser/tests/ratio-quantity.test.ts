import { describe, expect, it } from "bun:test";
import {
	type ASTNode,
	GramParseError,
	getAST,
	isIngredient,
	isQuantity,
	isRatioQuantity,
	isReference,
	isRelativeQuantity,
	isSection,
	isStep,
	isTemperature,
	isTimer,
	type RatioQuantityAST,
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

/** The quantity of the ingredient, reference or timer of `step`. */
function quantityOf(step: string) {
	const node = element(step);
	if (isIngredient(node) || isReference(node) || isTimer(node))
		return node.quantity;
	throw new Error("expected an ingredient, a reference or a timer");
}

/** The ratio of `step`, its `loc` left out. */
function ratio(step: string): Omit<RatioQuantityAST, "loc"> {
	const q = quantityOf(step);
	if (!isRatioQuantity(q)) throw new Error("expected a ratio");
	const { loc: _loc, ...rest } = q;
	return rest;
}

const single = (value: number) => ({
	type: "single",
	value,
	text: String(value),
});

describe("ratio with units on an ingredient", () => {
	it("reads an amount per amount of a target", () => {
		expect(ratio("Add @eggs{1 / 100 g @&flour}.")).toEqual({
			type: "RatioQuantity",
			numerator: { value: single(1), unit: null },
			denominator: { value: single(100), unit: "g" },
			target: "flour",
			referenceType: "ingredient",
			raw: "1 / 100 g @&flour",
		} as Omit<RatioQuantityAST, "loc">);
	});

	it("reads a fraction, a mixed number or a glyph as the numerator", () => {
		expect(ratio("Add @x{1/2 / 100 g @&flour}.").numerator.value?.value).toBe(
			0.5,
		);
		expect(ratio("Add @x{1 1/2 / 100 g @&flour}.").numerator.value?.value).toBe(
			1.5,
		);
		expect(ratio("Add @x{½ / 100 g @&flour}.").numerator.value?.value).toBe(
			0.5,
		);
	});

	it("keeps a range as the numerator", () => {
		expect(ratio("Add @x{15-20 g / 100 g @&flour}.").numerator).toEqual({
			value: {
				type: "range",
				value: 17.5,
				range: { min: 15, max: 20 },
				text: "15-20",
			},
			unit: "g",
		});
	});

	it("reads a denominator that is a unit alone, or nothing at all", () => {
		expect(ratio("Add @salt{15 g / L @&water}.").denominator).toEqual({
			value: null,
			unit: "L",
		});
		const perPiece = ratio("Add @sauce{1 / @&cutlet}.");
		expect(perPiece.denominator).toEqual({ value: null, unit: null });
		expect(perPiece.target).toBe("cutlet");
	});

	it("reads a counting unit on both sides", () => {
		const r = ratio("Add @parsley{1 tsp / 2 cloves @&garlic}.");
		expect(r.numerator.unit).toBe("tsp");
		expect(r.denominator).toEqual({ value: single(2), unit: "cloves" });
	});

	it("takes a space on one side of the slash", () => {
		expect(ratio("Add @x{1 /100 g @&flour}.").raw).toBe("1 /100 g @&flour");
		expect(ratio("Add @x{1/ 100 g @&flour}.").raw).toBe("1/ 100 g @&flour");
	});

	it("reads an intermediate as a variable target", () => {
		const r = ratio("Add @salt{2 g / 100 g &dough}.");
		expect(r.target).toBe("dough");
		expect(r.referenceType).toBe("variable");
	});

	it("keeps a multi-word unit for the compiler to refuse", () => {
		expect(ratio("Add @x{1 / 100 g of @&flour}.").denominator.unit).toBe(
			"g of",
		);
	});

	it("flags a denominator over zero as an invalid number", () => {
		expect(ratio("Add @x{1 / 1/0 g @&flour}.").denominator).toEqual({
			value: null,
			unit: "g",
			invalidNumber: "1/0",
		});
	});

	it("keeps the `=` modifier, for the compiler to refuse", () => {
		const node = element("Add @=eggs{1 / 100 g @&flour}.");
		if (!isIngredient(node)) throw new Error("expected an ingredient");
		expect(node.modifiers).toEqual(["="]);
		expect(isRatioQuantity(node.quantity)).toBe(true);
	});

	it("points `loc` at the braces' content", () => {
		const step = "Add @eggs{1 / 100 g @&flour}.";
		const q = quantityOf(step);
		if (!isRatioQuantity(q)) throw new Error("expected a ratio");
		expect(`## S\n\n${step}\n`.slice(q.loc?.start, q.loc?.end)).toBe(
			"1 / 100 g @&flour",
		);
	});
});

describe("ratio with units elsewhere", () => {
	it("reads a ratio on a reference", () => {
		expect(ratio("Add &stock{250 ml / 100 g @&rice}.")).toMatchObject({
			numerator: { value: single(250), unit: "ml" },
			denominator: { value: single(100), unit: "g" },
			target: "rice",
		});
	});

	it("reads a ratio on a composite parent", () => {
		const node = element("Add @yolks{2}<@eggs{1 / 100 g @&flour}>.");
		if (!isIngredient(node) || !node.composite)
			throw new Error("expected a composite");
		expect(isRatioQuantity(node.composite?.quantity)).toBe(true);
	});

	it("reads a proportional time, its duration as written", () => {
		const timer = element("Roast ~{15 min / 500 g @&roast}.");
		if (!isTimer(timer)) throw new Error("expected a timer");
		expect(timer.raw).toBe("15 min / 500 g @&roast");
		expect(ratio("Roast ~{15 min / 500 g @&roast}.")).toEqual({
			type: "RatioQuantity",
			numerator: { value: null, unit: null },
			denominator: { value: single(500), unit: "g" },
			durationRaw: "15 min",
			target: "roast",
			referenceType: "ingredient",
			raw: "15 min / 500 g @&roast",
		} as Omit<RatioQuantityAST, "loc">);
	});

	it("reads every form of duration as a timer's numerator", () => {
		expect(ratio("Roast ~{1:30 h / 1 kg @&roast}.").durationRaw).toBe("1:30 h");
		expect(ratio("Roast ~{15-20 min / 500 g @&roast}.").durationRaw).toBe(
			"15-20 min",
		);
		expect(ratio("Rest ~_{30 min / 1 kg &dough}.").referenceType).toBe(
			"variable",
		);
		expect(ratio("Fry ~{4 min / @&cutlet}.").denominator).toEqual({
			value: null,
			unit: null,
		});
	});

	it("leaves a multiplied proportional time as text, for the compiler", () => {
		const timer = element("Roast ~{15 min / 500 g @&roast * 2}.");
		if (!isTimer(timer)) throw new Error("expected a timer");
		expect(timer.quantity.type).toBe("TextQuantity");
		expect(timer.raw).toBe("15 min / 500 g @&roast * 2");
	});
});

describe("what a ratio leaves alone", () => {
	it("keeps a fraction a fraction", () => {
		expect(isQuantity(quantityOf("Add @milk{1/2 cup}."))).toBe(true);
		const timer = quantityOf("Wait ~{1/2 h}.");
		expect(isQuantity(timer)).toBe(true);
	});

	it("keeps a percentage a percentage", () => {
		expect(isRelativeQuantity(quantityOf("Add @x{70% @&flour}."))).toBe(true);
	});

	it("keeps a temperature a temperature", () => {
		const node = element("Bake at ^{180°C}.");
		if (!isTemperature(node)) throw new Error("expected a temperature");
		expect(node.value?.value).toBe(180);
		expect(node.unit).toBe("°C");
	});
});

describe("ratio errors", () => {
	const message = (step: string) => {
		try {
			element(step);
		} catch (e) {
			if (e instanceof GramParseError) return e.message;
			throw e;
		}
		throw new Error("expected a parse error");
	};

	it("suggests a space around the slash of a glued ratio", () => {
		for (const step of [
			"Add @x{1/100g @&flour}.",
			"Add @x{1/2 @&flour}.",
			"Add @x{1/2 cup @&milk}.",
		]) {
			expect(message(step)).toContain(
				"a ratio with a space around its slash, e.g. {1 / 100 g @&flour}",
			);
		}
	});

	it("refuses a multiplier after an ingredient's ratio", () => {
		expect(message("Add @x{1 / 100 g @&flour * 2}.")).toContain(
			"Invalid quantity",
		);
	});
});
