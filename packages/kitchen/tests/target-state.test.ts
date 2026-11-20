import { describe, expect, it } from "bun:test";
import { getAST } from "@gram-lang/parser";
import { applyScale, compile } from "../src/index";

const recipe = (steps: string) => compile(getAST(`## Crème\n\n${steps}\n`));

describe("a target state (1.5)", () => {
	it("is a checkpoint token where it was written in the step", () => {
		const step = recipe(
			"Cuire jusqu'à ={la nappe}(la crème nappe la cuillère) ->&crème{}",
		).sections[0]?.steps[0];
		expect(step?.content).toEqual([
			"Cuire jusqu'à ",
			{
				type: "checkpoint",
				state: "la nappe",
				note: "la crème nappe la cuillère",
			},
			expect.objectContaining({ type: "declaration" }),
		]);
	});

	it("leaves the note out when there is none, or when it is empty", () => {
		for (const line of ["Fouetter jusqu'au ={ruban}.", "={ruban}()"]) {
			const [token] =
				recipe(line).sections[0]?.steps[0]?.content.filter(
					(c) => typeof c === "object" && c.type === "checkpoint",
				) ?? [];
			expect(token).toEqual({ type: "checkpoint", state: "ruban" });
		}
	});

	it("changes nothing else in the recipe: schedule, shopping list, warnings", () => {
		const without = recipe(
			"Fouetter @jaunes{4} et @sucre{80 g}.\n\nCuire ~{10 min} dans la #casserole.",
		);
		const withState = recipe(
			"Fouetter @jaunes{4} et @sucre{80 g} jusqu'au ={ruban}.\n\nCuire ~{10 min} dans la #casserole jusqu'à ={la nappe}(test).",
		);
		for (const key of [
			"schedule",
			"tasks",
			"shopping_list",
			"cookware",
			"miseEnPlace",
			"metrics",
			"warnings",
			"registry",
		] as const) {
			expect(withState[key]).toBeDefined();
			expect(withState[key]).toEqual(without[key]);
		}
	});

	it("is not scaled", () => {
		const scaled = applyScale(
			recipe("Fouetter @sucre{80 g} jusqu'au ={2 rubans}."),
			2,
		);
		expect(scaled.sections[0]?.steps[0]?.content).toContainEqual({
			type: "checkpoint",
			state: "2 rubans",
		});
	});
});
