import { describe, expect, it } from "bun:test";
import { getDictionary } from "@gram-lang/i18n";
import {
	bakersBadgeTitle,
	isBakersModified,
	isDisplayModified,
	isPhysicsModified,
	isStockModified,
	physicsBadgeTitle,
	resetBakers,
	resetDisplay,
	resetPhysics,
	stockBadgeTitle,
} from "./optionSections";
import { defaultOptions } from "./settingsStorage";

const en = getDictionary("en");
const fr = getDictionary("fr");
const defaults = () => defaultOptions();

describe("baker's math", () => {
	it("is untouched by default", () => {
		expect(isBakersModified(defaults())).toBe(false);
	});

	it("is modified by switching it off, hiding the quantities or choosing a reference", () => {
		expect(isBakersModified({ ...defaults(), bakersMath: false })).toBe(true);
		expect(isBakersModified({ ...defaults(), bakersMathOnly: true })).toBe(
			true,
		);
		expect(isBakersModified({ ...defaults(), bakersReference: "flour" })).toBe(
			true,
		);
	});

	it("names its reference in the tooltip, in the language asked", () => {
		expect(bakersBadgeTitle(defaults(), en)).toBe(
			en.playground.sections.bakersMath,
		);
		expect(
			bakersBadgeTitle({ ...defaults(), bakersReference: "flour" }, fr),
		).toBe(`${fr.playground.sections.bakersMath}: flour`);
	});

	it("resets to the defaults and forgets the reference, leaving the other options", () => {
		const changed = {
			...defaults(),
			bakersMath: true,
			bakersMathOnly: true,
			bakersReference: "flour",
			comments: "hide" as const,
		};
		const reset = resetBakers(changed);
		expect(isBakersModified(reset)).toBe(false);
		expect(reset.bakersReference).toBeUndefined();
		expect(reset.comments).toBe("hide");
	});
});

describe("display", () => {
	it("is modified by hiding the comments or the quantities in the steps", () => {
		expect(isDisplayModified(defaults())).toBe(false);
		expect(isDisplayModified({ ...defaults(), comments: "hide" })).toBe(true);
		expect(isDisplayModified({ ...defaults(), stepQuantities: "hide" })).toBe(
			true,
		);
	});

	it("resets both, leaving the other options", () => {
		const reset = resetDisplay({
			...defaults(),
			comments: "hide",
			stepQuantities: "hide",
			bakersMath: true,
		});
		expect(isDisplayModified(reset)).toBe(false);
		expect(reset.bakersMath).toBe(true);
	});
});

describe("physics and nutrition", () => {
	it("is modified by switching an analysis off or changing the nutrition basis", () => {
		expect(isPhysicsModified(defaults())).toBe(false);
		expect(
			isPhysicsModified({ ...defaults(), massStandardization: false }),
		).toBe(true);
		expect(isPhysicsModified({ ...defaults(), yieldCalculation: false })).toBe(
			true,
		);
		expect(
			isPhysicsModified({ ...defaults(), nutritionEstimation: false }),
		).toBe(true);
		expect(
			isPhysicsModified({ ...defaults(), nutritionBasis: "per100g" }),
		).toBe(true);
	});

	it("lists the analyses that are on, or says none is", () => {
		const all = physicsBadgeTitle(
			{
				...defaults(),
				massStandardization: true,
				yieldCalculation: true,
				nutritionEstimation: true,
			},
			en,
		);
		expect(all.split(" · ")).toEqual([
			en.playground.options.massStandardization,
			en.playground.options.yieldManagement,
			en.playground.options.nutrition,
		]);
		expect(
			physicsBadgeTitle(
				{
					...defaults(),
					massStandardization: false,
					yieldCalculation: false,
					nutritionEstimation: false,
				},
				fr,
			),
		).toBe(fr.playground.badges.inactive);
	});

	it("resets the analyses and the basis", () => {
		const reset = resetPhysics({
			...defaults(),
			massStandardization: false,
			yieldCalculation: false,
			nutritionEstimation: false,
			nutritionBasis: "total",
		});
		expect(isPhysicsModified(reset)).toBe(false);
	});
});

describe("stock", () => {
	it("is modified as soon as one module is on hand", () => {
		expect(isStockModified(undefined)).toBe(false);
		expect(isStockModified(new Set())).toBe(false);
		expect(isStockModified(new Set(["a"]))).toBe(true);
	});

	it("counts the modules on hand in the tooltip", () => {
		expect(stockBadgeTitle(new Set(["a", "b"]), en)).toContain("2");
		expect(stockBadgeTitle(undefined, fr)).toContain("0");
		expect(stockBadgeTitle(new Set(["a"]), fr)).not.toBe(
			stockBadgeTitle(new Set(["a"]), en),
		);
	});
});
