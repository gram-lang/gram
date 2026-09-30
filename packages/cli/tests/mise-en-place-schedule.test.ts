import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { compile, scheduleFor } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { passiveTimers } from "../src/core/schedule";
import { exportRecipe } from "../src/services/exporter";
import { parseMiseEnPlace } from "../src/services/mise-en-place-flag";
import { buildViewModel } from "../src/services/viewer";
import { prepareRecipeData } from "../src/ui/cook/prepare";
import { cleanupTmpFile, writeTmpFile } from "./helpers";

// A section with a retro-planning offset makes the two timelines differ.
const TART = `## Pastry ~{-2d}

Mix @flour{200g}(sifted).

## Assembly

Combine the pastry with @filling{300g}(chopped).
`;

// A comment before the resting step shifts its index in `sections[].steps`
// (the schedule blocks' index) away from its index among the cook's steps.
const REST = `## Dough

// Any flour will do.

Mix @flour{500g}.

[Rest] Let it rest ~_proof{45min}.

Shape the dough and let it rest ~_{10min}.
`;

describe("parseMiseEnPlace", () => {
	it("maps the kebab-case flag to the renderer's camelCase value", () => {
		expect(parseMiseEnPlace("per-section")).toBe("perSection");
		expect(parseMiseEnPlace("upfront")).toBe("upfront");
	});

	it("leaves it unset when the flag is absent", () => {
		expect(parseMiseEnPlace(undefined)).toBeUndefined();
		expect(parseMiseEnPlace("")).toBeUndefined();
	});

	it("reports and exits on an unknown value", () => {
		const exit = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);
		// reportError prints through the prompt library, straight to stdout.
		const out = spyOn(process.stdout, "write").mockImplementation(() => true);
		try {
			expect(() => parseMiseEnPlace("global")).toThrow("exit");
			expect(() => parseMiseEnPlace("perSection")).toThrow("exit");
		} finally {
			exit.mockRestore();
			out.mockRestore();
		}
	});
});

describe("passiveTimers", () => {
	const compiled = compile(getAST(REST));

	it("finds a step's timers by its index in the section, comments included", () => {
		const steps = compiled.sections[0]!.steps;
		const restIdx = steps.findIndex(
			(s) => s.type === "step" && s.action === "Rest",
		);
		expect(restIdx).toBeGreaterThan(0);
		expect(passiveTimers(compiled, 0, restIdx)).toEqual([
			{ name: "proof", duration: 45 },
		]);
	});

	it("returns anonymous timers without a name", () => {
		const steps = compiled.sections[0]!.steps;
		const last = steps.length - 1;
		expect(passiveTimers(compiled, 0, last)).toEqual([
			{ name: undefined, duration: 10 },
		]);
	});

	it("keeps the order the timers are written in the step, not the schedule's", () => {
		const two = compile(
			getAST(
				"## A\n\n[Bake] Put in ~_oven{30min} then rest ~_{10min}.\n\n[Cool] Cool ~_{5min} then ~_fridge{20min}.\n",
			),
		);
		expect(passiveTimers(two, 0, 0)).toEqual([
			{ name: "oven", duration: 30 },
			{ name: undefined, duration: 10 },
		]);
		expect(passiveTimers(two, 0, 1)).toEqual([
			{ name: undefined, duration: 5 },
			{ name: "fridge", duration: 20 },
		]);
	});

	it("returns nothing for a step without a background timer", () => {
		expect(passiveTimers(compiled, 0, 0)).toEqual([]);
		expect(passiveTimers(compiled, 5, 0)).toEqual([]);
	});

	it("gives a timer the same length whichever timeline it is read from", () => {
		const total = (mode: "perSection" | "upfront") =>
			scheduleFor(compiled, mode)
				?.blocks.filter((b) => b.kind === "passive")
				.map((b) => b.end - b.start)
				.sort();
		expect(total("upfront")).toEqual(total("perSection"));
	});
});

describe("cook mode timers", () => {
	it("keeps the right timer on the right step when a comment shifts the indexes", () => {
		const data = prepareRecipeData(compile(getAST(REST)));
		const rest = data.steps.find((s) => s.step.action === "Rest");
		expect(rest?.timers.map((t) => [t.name, t.durationMs])).toEqual([
			["proof", 45 * 60_000],
		]);
	});
});

describe("view, export and print follow --mise-en-place", () => {
	const paths: string[] = [];
	afterEach(async () => {
		while (paths.length > 0) await cleanupTmpFile(paths.pop()!);
	});
	async function tmp(content: string): Promise<string> {
		const path = await writeTmpFile(content);
		paths.push(path);
		return path;
	}

	it("takes the header times from the chosen timeline", async () => {
		const path = await tmp(TART);
		const { perSection, upfront } = compile(getAST(TART)).schedules;
		expect(perSection.totalTime).not.toBe(upfront.totalTime);

		const per = await buildViewModel(path, {});
		const up = await buildViewModel(path, { schedule: "upfront" });
		expect(per.times?.total).toBe(perSection.totalTime);
		expect(per.times?.rest).toBe(perSection.idleTime);
		expect(up.times?.total).toBe(upfront.totalTime);
		expect(up.times?.rest).toBe(upfront.idleTime);
	});

	it("defaults to preparing right before each section", async () => {
		const path = await tmp(TART);
		const model = await buildViewModel(path, {});
		expect(model.times?.total).toBe(
			compile(getAST(TART)).schedules.perSection.totalTime,
		);
	});

	it("keeps active and preparation time the same in both", async () => {
		const path = await tmp(TART);
		const per = await buildViewModel(path, {});
		const up = await buildViewModel(path, { schedule: "upfront" });
		expect(up.times?.active).toBe(per.times?.active);
		expect(up.times?.prep).toBe(per.times?.prep);
	});

	it("shows a step's background timer length in the view", async () => {
		const path = await tmp(REST);
		const model = await buildViewModel(path, {});
		const rest = model.sections[0]!.steps.find((s) => s.action === "Rest");
		expect(rest?.timerMinutes).toBe(45);
	});

	it("changes the exported Markdown total with the flag", async () => {
		const path = await tmp(TART);
		const per = await exportRecipe(path, "md", null, undefined, {
			schedule: "perSection",
		});
		const up = await exportRecipe(path, "md", null, undefined, {
			schedule: "upfront",
		});
		expect(per).not.toBe(up);
	});

	it("changes the exported print total with the flag", async () => {
		const path = await tmp(TART);
		const per = await exportRecipe(path, "html", null, undefined, {
			schedule: "perSection",
		});
		const up = await exportRecipe(path, "html", null, undefined, {
			schedule: "upfront",
		});
		expect(per).not.toBe(up);
	});
});
