import { describe, expect, it } from "bun:test";
import { RECIPE_SETTINGS, VIEW_SETTINGS } from "@gram-lang/renderer";
import build from "../src/commands/build";
import cook from "../src/commands/cook";
import exportCommand from "../src/commands/export";
import plan from "../src/commands/plan";
import print from "../src/commands/print";
import shop from "../src/commands/shop";
import view from "../src/commands/view";
import watch from "../src/commands/watch";
import {
	type RecipeSettingKey,
	type ViewSettingKey,
	settingFlagName,
} from "../src/services/setting-args";

/*
 * Every setting of the renderer's descriptors is a CLI flag, named after it,
 * on every command where it changes something. The editor side is checked in
 * the language server's `settings-parity.test.ts`, the playground side in
 * `settingsStorage.test.ts`.
 */

type Command = { args?: unknown };

function flagsOf(command: Command): string[] {
	const args = command.args;
	return args && typeof args === "object" ? Object.keys(args) : [];
}

const ALL_VIEW = Object.keys(VIEW_SETTINGS) as ViewSettingKey[];
const ALL_RECIPE = Object.keys(RECIPE_SETTINGS) as RecipeSettingKey[];

/**
 * Which settings each command exposes, and why the others don't apply. A new
 * setting fails here until it is placed in this table.
 */
const EXPOSED: Record<
	string,
	{ command: Command; view: ViewSettingKey[]; recipe: RecipeSettingKey[] }
> = {
	// The recipe, printed or exported: every setting.
	print: { command: print, view: ALL_VIEW, recipe: ALL_RECIPE },
	export: { command: exportCommand, view: ALL_VIEW, recipe: ALL_RECIPE },
	// The recipe in the terminal. `comments` and `stepQuantities` come when it
	// renders through the renderer (views plan, phase 4): this is the one
	// temporary exception.
	view: {
		command: view,
		view: ["miseEnPlace", "rests", "nutritionBasis", "bakersMathOnly"],
		recipe: ALL_RECIPE,
	},
	// The run sheet: no nutrition, no quantities in steps, no analysis.
	plan: {
		command: plan,
		view: ["miseEnPlace", "rests", "comments"],
		recipe: [],
	},
	// Cooking: the timeline (total time, timers) and the analyzed masses.
	cook: { command: cook, view: ["miseEnPlace", "rests"], recipe: ALL_RECIPE },
	// Analyzed data, not a view of the recipe.
	build: { command: build, view: [], recipe: ALL_RECIPE },
	watch: { command: watch, view: [], recipe: ALL_RECIPE },
	shop: { command: shop, view: [], recipe: ALL_RECIPE },
};

describe("CLI flags and the setting descriptors", () => {
	for (const [name, { command, view, recipe }] of Object.entries(EXPOSED)) {
		it(`gram ${name} has a flag for each setting it exposes, and no other`, () => {
			const flags = new Set(flagsOf(command));
			for (const key of [...view, ...recipe]) {
				expect(flags.has(settingFlagName(key))).toBe(true);
			}
			for (const key of [...ALL_VIEW, ...ALL_RECIPE]) {
				if ((view as string[]).includes(key)) continue;
				if ((recipe as string[]).includes(key)) continue;
				expect(flags.has(settingFlagName(key))).toBe(false);
			}
		});
	}

	it("gives every setting a flag on at least one command", () => {
		const everywhere = new Set(
			Object.values(EXPOSED).flatMap(({ command }) => flagsOf(command)),
		);
		for (const key of [...ALL_VIEW, ...ALL_RECIPE]) {
			expect(everywhere.has(settingFlagName(key))).toBe(true);
		}
	});
});
