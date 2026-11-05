import { describe, expect, it } from "bun:test";
import {
	DEFAULT_MISE_EN_PLACE_MODE,
	DEFAULT_REST_CHOICE,
	MISE_EN_PLACE_MODES,
	REST_CHOICES,
} from "@gram-lang/kitchen";
import {
	DEFAULT_RECIPE_SETTINGS,
	DEFAULT_VIEW_SETTINGS,
	RECIPE_SETTINGS,
	SETTINGS,
	VIEW_SETTINGS,
	parseRecipeSettings,
	parseViewSettings,
	recipeSettingsToAnalyzerOptions,
	viewSettingsToRendererOptions,
} from "../src/index";

describe("setting descriptors", () => {
	it("take the planning values and defaults from the kitchen", () => {
		expect(VIEW_SETTINGS.miseEnPlace.values).toEqual(MISE_EN_PLACE_MODES);
		expect(VIEW_SETTINGS.miseEnPlace.default).toBe(DEFAULT_MISE_EN_PLACE_MODE);
		expect(VIEW_SETTINGS.rests.values).toEqual(REST_CHOICES);
		expect(VIEW_SETTINGS.rests.default).toBe(DEFAULT_REST_CHOICE);
	});

	it("name each descriptor after its key", () => {
		for (const [key, d] of Object.entries(VIEW_SETTINGS)) {
			expect(d.key).toBe(key);
			expect(d.kind).toBe("view");
		}
		for (const [key, d] of Object.entries(RECIPE_SETTINGS)) {
			expect(d.key).toBe(key);
			expect(d.kind).toBe("recipe");
		}
	});

	it("list every setting once", () => {
		const keys = SETTINGS.map((d) => d.key);
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.length).toBe(
			Object.keys(VIEW_SETTINGS).length + Object.keys(RECIPE_SETTINGS).length,
		);
	});

	it("give every choice a default among its values", () => {
		for (const d of SETTINGS) {
			expect(d.accepts(d.default)).toBe(true);
			if (d.type === "choice") expect(d.values).toContain(d.default);
		}
	});

	it("turn the analyzer on by default, as the engine does", () => {
		expect(DEFAULT_RECIPE_SETTINGS).toEqual({
			bakersMath: true,
			massStandardization: true,
			yieldCalculation: true,
			nutritionEstimation: true,
		});
	});
});

describe("parseViewSettings", () => {
	it("falls back on every default without a configuration", () => {
		for (const raw of [undefined, null, "perSection", 42, []]) {
			expect(parseViewSettings(raw)).toEqual({ ...DEFAULT_VIEW_SETTINGS });
		}
		expect(DEFAULT_VIEW_SETTINGS).toEqual({
			miseEnPlace: "perSection",
			rests: "shortest",
			comments: "show",
			nutritionBasis: "auto",
			bakersMathOnly: false,
			stepQuantities: "show",
		});
	});

	it("keeps the known values and drops the rest one by one", () => {
		expect(
			parseViewSettings({
				miseEnPlace: "upfront",
				rests: "forever",
				comments: "hide",
				nutritionBasis: "per-100g",
				bakersMathOnly: "true",
				stepQuantities: "hide",
				unrelated: 1,
			}),
		).toEqual({
			miseEnPlace: "upfront",
			rests: "shortest",
			comments: "hide",
			nutritionBasis: "auto",
			bakersMathOnly: false,
			stepQuantities: "hide",
		});
	});

	it("reads a flag only from a boolean", () => {
		expect(parseViewSettings({ bakersMathOnly: true }).bakersMathOnly).toBe(
			true,
		);
		expect(parseViewSettings({ bakersMathOnly: 1 }).bakersMathOnly).toBe(false);
	});
});

describe("parseRecipeSettings", () => {
	it("keeps a toggle turned off and defaults the others", () => {
		expect(
			parseRecipeSettings({ yieldCalculation: false, bakersMath: "no" }),
		).toEqual({
			bakersMath: true,
			massStandardization: true,
			yieldCalculation: false,
			nutritionEstimation: true,
		});
	});
});

describe("settings to options", () => {
	it("maps the view settings onto the renderer options", () => {
		expect(
			viewSettingsToRendererOptions({
				...DEFAULT_VIEW_SETTINGS,
				stepQuantities: "hide",
				nutritionBasis: "per100g",
			}),
		).toEqual({
			miseEnPlace: "perSection",
			rests: "shortest",
			comments: "show",
			nutritionBasis: "per100g",
			bakersMathOnly: false,
			hideStepQty: true,
		});
	});

	it("maps the recipe settings onto the analyzer options", () => {
		expect(
			recipeSettingsToAnalyzerOptions({
				...DEFAULT_RECIPE_SETTINGS,
				massStandardization: false,
			}),
		).toEqual({
			enableBakersMath: true,
			enableMassStandardization: false,
			enableYieldCalculation: true,
			enableNutritionalEstimation: true,
		});
	});
});

describe("SETTINGS", () => {
	it("can be walked without knowing each setting", () => {
		const choices = SETTINGS.filter((d) => d.type === "choice").map(
			(d) => d.type === "choice" && d.values.length,
		);
		expect(choices.every((n) => typeof n === "number" && n >= 2)).toBe(true);
	});
});
