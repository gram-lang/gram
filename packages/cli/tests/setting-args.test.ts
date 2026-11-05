import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { runPipeline } from "../src/core/pipeline";
import { cleanupTmpFile, makeDb, writeTmpFile } from "./helpers";
import { RECIPE_SETTINGS, VIEW_SETTINGS } from "@gram-lang/renderer";
import {
	RECIPE_VIEW_SETTINGS,
	STEP_QTY_ALIAS_ARG,
	readRecipeSettingArgs,
	readViewSettingArgs,
	recipeSettingArgs,
	settingFlagName,
	viewSettingArgs,
} from "../src/services/setting-args";

describe("setting flags", () => {
	it("name every flag after its setting, in kebab-case", () => {
		expect(settingFlagName("nutritionBasis")).toBe("nutrition-basis");
		expect(settingFlagName("stepQuantities")).toBe("step-quantities");
		expect(settingFlagName("massStandardization")).toBe("mass-standardization");
	});

	it("give the recipe view a flag for every view setting", () => {
		expect([...RECIPE_VIEW_SETTINGS].sort()).toEqual(
			Object.keys(VIEW_SETTINGS).sort(),
		);
		const args = viewSettingArgs(RECIPE_VIEW_SETTINGS);
		for (const key of RECIPE_VIEW_SETTINGS) {
			expect(args[settingFlagName(key)]).toBeDefined();
		}
	});

	it("keep the names the flags had before", () => {
		expect(viewSettingArgs(["nutritionBasis"]).nutrition).toBeDefined();
		expect(STEP_QTY_ALIAS_ARG["step-qty"]).toBeDefined();
	});

	it("give every recipe setting a flag that can be turned off", () => {
		const args = recipeSettingArgs();
		for (const key of Object.keys(RECIPE_SETTINGS)) {
			const arg = args[settingFlagName(key as keyof typeof RECIPE_SETTINGS)];
			expect(arg?.type).toBe("boolean");
			expect(arg && "negativeDescription" in arg).toBe(true);
		}
	});
});

describe("readViewSettingArgs", () => {
	it("leaves out a setting whose flag is absent", () => {
		expect(readViewSettingArgs({}, RECIPE_VIEW_SETTINGS)).toEqual({});
	});

	it("reads the CLI spelling back to the setting's value", () => {
		expect(
			readViewSettingArgs(
				{
					"mise-en-place": "per-day",
					"nutrition-basis": "per-portion",
					"bakers-math-only": true,
					"step-quantities": "hide",
				},
				RECIPE_VIEW_SETTINGS,
			),
		).toEqual({
			miseEnPlace: "perDay",
			nutritionBasis: "perPortion",
			bakersMathOnly: true,
			stepQuantities: "hide",
		});
	});

	it("reads the former names", () => {
		expect(
			readViewSettingArgs(
				{ nutrition: "per-100g", "step-qty": false },
				RECIPE_VIEW_SETTINGS,
			),
		).toEqual({ nutritionBasis: "per100g", stepQuantities: "hide" });
	});

	it("lets the new name win over the former one", () => {
		expect(
			readViewSettingArgs(
				{
					"nutrition-basis": "total",
					nutrition: "per-100g",
					"step-quantities": "show",
					"step-qty": false,
				},
				RECIPE_VIEW_SETTINGS,
			),
		).toEqual({ nutritionBasis: "total", stepQuantities: "show" });
	});

	it("only reads the settings the command exposes", () => {
		expect(
			readViewSettingArgs({ comments: "hide", rests: "longest" }, [
				"miseEnPlace",
				"rests",
			]),
		).toEqual({ rests: "longest" });
	});

	it("reports and exits on an unknown value of the former name", () => {
		const exit = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);
		const out = spyOn(process.stdout, "write").mockImplementation(() => true);
		try {
			expect(() =>
				readViewSettingArgs({ nutrition: "bad" }, RECIPE_VIEW_SETTINGS),
			).toThrow("exit");
		} finally {
			exit.mockRestore();
			out.mockRestore();
		}
	});
});

describe("readRecipeSettingArgs", () => {
	it("keeps everything on without a flag, as the engine", () => {
		expect(readRecipeSettingArgs({})).toEqual({
			bakersMath: true,
			massStandardization: true,
			yieldCalculation: true,
			nutritionEstimation: true,
		});
	});

	it("turns off what --no-<flag> turns off", () => {
		expect(
			readRecipeSettingArgs({
				"mass-standardization": false,
				"bakers-math": true,
			}),
		).toEqual({
			bakersMath: true,
			massStandardization: false,
			yieldCalculation: true,
			nutritionEstimation: true,
		});
	});
});

describe("recipe settings reach the analyzer", () => {
	const paths: string[] = [];
	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});

	it("turns off the conversion to grams and the nutrition", async () => {
		const path = await writeTmpFile("## Prep\n\n[Mix] Add @flour{250ml}.\n");
		paths.push(path);
		const db = makeDb({
			flour: {
				physical: { density: 0.59 },
				nutrition: { calories: 364, protein: 10, carbs: 76, fat: 1 },
			} as never,
		});
		const on = await runPipeline(path, { db });
		const off = await runPipeline(path, {
			db,
			recipe: readRecipeSettingArgs({
				"mass-standardization": false,
				"nutrition-estimation": false,
			}),
		});
		const mass = (r: typeof on) =>
			(
				r.analyzed?.result.shopping_list[0] as
					| { normalizedMass?: number }
					| undefined
			)?.normalizedMass;
		expect(mass(on)).toBeGreaterThan(0);
		expect(mass(off)).toBeUndefined();
		expect(on.analyzed?.result.metrics?.nutrition).toBeDefined();
		expect(off.analyzed?.result.metrics?.nutrition).toBeUndefined();
	});
});
