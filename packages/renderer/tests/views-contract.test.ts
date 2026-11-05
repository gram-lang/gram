import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type IngredientData, analyze } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import {
	type Format,
	type PrepareViewsOptions,
	type RenderableCompilationResult,
	type SettingKey,
	VIEW_SETTINGS,
	type ViewSettings,
	prepareViews,
	render,
	views,
} from "../src/index";

// The contract every view of the registry keeps, whatever its formats: it
// renders every fixture with any settings without throwing, never lets markup
// of the recipe through, reacts to each setting it says it honors, and to no
// other. A new view gets all of it by joining `views`; a new setting needs a
// probe below, or the test of the probes fails.

const database: Record<string, IngredientData> = {
	flour: {
		name: "Flour",
		nutrition: {
			calories: 364,
			protein: 10,
			carbs: 76,
			fat: 1,
			sat_fat: 0.2,
			sugar: 0.3,
			sodium: 2,
		},
	},
};

const RICH = `---
title: Country bread
portions: 2
---

## Dough ->&dough

// Use a strong flour.

[Mix] Mix @*flour{500g} with @water{350g} and @salt{10g} in a #bowl{}, knead ~{20min}. // keep it cold

[Rise] Let it rise ~_{8-16h}.

## Bake

[Shape] Shape &dough{} on a #tray{} and leave it ~_{1-2h}.

[Bake] Bake for ~{30min}.
`;

const PAYLOAD = `---
title: <script>alert(1)</script>
---

## <img src=x onerror=alert(2)>

// <script>alert(3)</script>

Mix @<b>flour{200g} in a #<i>pan{} for ~{5min}. // <script>alert(4)</script>
`;

const analyzed = (source: string): RenderableCompilationResult =>
	analyze(compile(getAST(source)), database).result;

const FIXTURES: Record<string, RenderableCompilationResult> = {
	rich: analyzed(RICH),
	payload: analyzed(PAYLOAD),
	sample: analyzed(
		readFileSync(join(import.meta.dir, "fixtures", "sample.gram"), "utf-8"),
	),
	empty: compile(getAST("---\ntitle: Note\n---\n")),
};

const KITCHEN = {
	timeZone: "Europe/Paris",
	availability: { daily: [{ start: "08:00", end: "22:00" }] },
	now: "2026-10-01T09:00:00Z",
};
const SERVINGS: Record<string, PrepareViewsOptions> = {
	"in days": {},
	"on the calendar": { kitchen: KITCHEN, serveAt: "2026-10-11T13:00" },
};

/** For each view setting: a value other than the default, that a view honoring it must show. */
const PROBES: { [K in SettingKey]: ViewSettings[K] } = {
	miseEnPlace: "upfront",
	rests: "longest",
	comments: "hide",
	nutritionBasis: "per100g",
	bakersMathOnly: true,
	stepQuantities: "hide",
};

const ALL_CHANGED: Partial<ViewSettings> = PROBES;

function out(
	viewId: (typeof views)[number]["id"],
	format: Format,
	settings: Partial<ViewSettings> = {},
	serving: PrepareViewsOptions = {},
	fixture = FIXTURES.rich!,
): string | null {
	return render(viewId, prepareViews(fixture, settings, serving), format);
}

describe("every view setting has a probe", () => {
	it("so a new setting cannot slip past the contract", () => {
		expect(Object.keys(PROBES).sort()).toEqual(
			Object.keys(VIEW_SETTINGS).sort(),
		);
		for (const [key, value] of Object.entries(PROBES)) {
			const descriptor = VIEW_SETTINGS[key as SettingKey];
			expect(value).not.toEqual(descriptor.default);
		}
	});
});

for (const view of views) {
	describe(`the ${view.id} view`, () => {
		for (const format of view.formats) {
			for (const [name, fixture] of Object.entries(FIXTURES)) {
				for (const [when, serving] of Object.entries(SERVINGS)) {
					for (const settings of [{}, ALL_CHANGED]) {
						const label = settings === ALL_CHANGED ? "changed" : "default";
						it(`renders ${name} in ${format}, ${when}, with the ${label} settings`, () => {
							const text = out(view.id, format, settings, serving, fixture);
							if (text === null) return;
							expect(typeof text).toBe("string");
							if (
								name === "payload" &&
								format !== "markdown" &&
								format !== "text"
							) {
								// The payload is there, escaped: the check below is not vacuous.
								expect(text).toContain("&lt;script&gt;alert(1)");
							}
							if (name === "payload" && format !== "text") {
								expect(text).not.toMatch(/<script>alert/);
								expect(text).not.toMatch(/<img src=x/);
								expect(text).not.toMatch(/<b>flour/);
							}
						});
					}
				}
			}

			for (const key of view.honors) {
				it(`follows ${key} in ${format}`, () => {
					expect(out(view.id, format, { [key]: PROBES[key] })).not.toBe(
						out(view.id, format),
					);
				});
			}

			const ignored = (Object.keys(PROBES) as SettingKey[]).filter(
				(key) => !(view.honors as readonly SettingKey[]).includes(key),
			);
			for (const key of ignored) {
				it(`ignores ${key} in ${format}, which it does not honor`, () => {
					expect(out(view.id, format, { [key]: PROBES[key] })).toBe(
						out(view.id, format),
					);
				});
			}
		}
	});
}
