import { describe, expect, it, spyOn } from "bun:test";
import { diffRecipes } from "@gram-lang/analyzer";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { renderToString } from "ink";
import { prepareRecipeData } from "../src/ui/cook/prepare";
import StepView from "../src/ui/cook/StepView";
import type { ActiveTimer } from "../src/ui/cook/types";
import { renderDiffResult } from "../src/ui/diff";

const ANSI = /\x1b\[[0-9;]*m/g;
const recipeOf = (steps: string) =>
	prepareRecipeData(compile(getAST(`## Crème\n\n${steps}\n`)));

/** What `gram cook` shows for the first step, colors left out. */
function screen(
	steps: string,
	{
		lang,
		activeTimers = [],
	}: { lang?: string; activeTimers?: ActiveTimer[] } = {},
): string {
	const recipe = recipeOf(steps);
	return renderToString(
		<StepView
			flatStep={recipe.steps[0]!}
			stepIndex={0}
			totalSteps={recipe.steps.length}
			title="Crème"
			activeTimers={activeTimers}
			tick={0}
			quitConfirm={false}
			timerSelect={false}
			timerSelectIndex={0}
			registry={recipe.registry}
			massMap={{}}
			width={100}
			lang={lang}
		/>,
		{ columns: 100 },
	).replace(ANSI, "");
}

// `gram cook` shows the state in the sentence and, under the step, what to
// look for and how to check it (1.5).
describe("gram cook target states", () => {
	const step =
		"Cuire jusqu'à ={la nappe}(la crème nappe la cuillère), puis servir.";

	it("keeps the state in the sentence, its note on the target line", () => {
		const out = screen(step);
		expect(out).toContain("Cuire jusqu'à la nappe, puis servir.");
		expect(out).toContain("Target: la nappe — la crème nappe la cuillère");
	});

	it("speaks the language of the config", () => {
		expect(screen(step, { lang: "fr" })).toContain(
			"État attendu : la nappe — la crème nappe la cuillère",
		);
	});

	it("shows no target line on a step without one", () => {
		expect(screen("Cuire la crème.")).not.toContain("Target:");
	});

	it("gives each timer of the step its target states, to check when it rings", () => {
		const [timer] = recipeOf(
			"Cuire ~{10 min} jusqu'à ={la nappe} puis ={tiède}.",
		).steps[0]!.timers;
		expect(timer?.checks).toEqual(["la nappe", "tiède"]);
		expect(recipeOf("Cuire ~{10 min}.").steps[0]!.timers[0]).not.toHaveProperty(
			"checks",
		);

		const done = { ...timer!, startedAt: 0, done: true };
		expect(
			screen("Cuire ~{10 min} jusqu'à ={la nappe}.", {
				lang: "fr",
				activeTimers: [done],
			}),
		).toContain("Vérifiez : la nappe");
	});
});

describe("gram diff target states", () => {
	it("lists the target states that changed", () => {
		const a = compile(getAST("## Crème\n\nCuire jusqu'à ={la nappe}.\n"));
		const b = compile(getAST("## Crème\n\nCuire jusqu'à ={épais}(test).\n"));
		const lines: string[] = [];
		const log = spyOn(console, "log").mockImplementation((...args) => {
			lines.push(args.join(" "));
		});
		try {
			renderDiffResult(diffRecipes(a, b), "a → b");
		} finally {
			log.mockRestore();
		}
		const out = lines.join("\n").replace(ANSI, "");
		expect(out).toContain("TARGET STATES");
		expect(out).toContain("[Crème] la nappe → épais (test)");
	});
});
