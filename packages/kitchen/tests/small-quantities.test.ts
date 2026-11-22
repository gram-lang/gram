import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { compile } from "../src/index";

// #230: a stored quantity is never rounded to 0. Rounded to 2 decimals in
// the author's unit, a recipe divided by 10 lost its salt (`0.02 kg` →
// `0 kg`), divided by 4 it doubled it (`0.005 kg` → `0.01 kg`), and a
// ratio of a pinch weighed `0 g`.

const shopping = (body: string, scaleFactor?: number) =>
	Object.fromEntries(
		compile(getAST(`## Prep\n\n${body}\n`), { scaleFactor }).shopping_list.map(
			(entry) => [entry.name, entry.qty],
		),
	);

describe("a small quantity (#230)", () => {
	const recipe = "Add @saffron{0.03 g}, @salt{0.02 kg} and @water{0.5 l}.";

	it("keeps its digits once scaled down", () => {
		expect(shopping(recipe, 0.25)).toEqual({
			saffron: 0.0075,
			salt: 0.005,
			water: 0.13,
		});
		expect(shopping(recipe, 0.1)).toEqual({
			saffron: 0.003,
			salt: 0.002,
			water: 0.05,
		});
	});

	it("is not stored as 0 in the shopping list", () => {
		expect(shopping("Add @a{0.004 g}.").a).toBe(0.004);
	});

	it("keeps the amount of a ratio of a small target", () => {
		expect(shopping("Add @b{1 pinch}.\n\nAdd @a{15 g / L @&b}.").a).toBe(
			0.0047,
		);
	});
});
