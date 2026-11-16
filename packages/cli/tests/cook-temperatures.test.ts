import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { getTempDisplay } from "../src/ui/cook/StepView";

// biome-ignore lint/suspicious/noExplicitAny: reading a compiled step token.
const temperatureOf = (step: string): any =>
	compile(getAST(`## A\n\n${step}\n`)).sections[0]?.steps[0]?.content.find(
		// biome-ignore lint/suspicious/noExplicitAny: reading a compiled step token.
		(c: any) => c?.type === "temperature",
	);

// `gram cook` shows a temperature the way the views do, with its note.
describe("gram cook temperatures", () => {
	it("shows the value and unit like the views", () => {
		expect(getTempDisplay(temperatureOf("Bake at ^{180°C}."))).toBe("180 °C");
	});

	it("shows a temperature in words", () => {
		expect(getTempDisplay(temperatureOf("Cook on ^{high}."))).toBe("high");
	});

	it("shows the note after the value (1.5)", () => {
		expect(getTempDisplay(temperatureOf("Bake at ^{160°C}(fan)."))).toBe(
			"160 °C (fan)",
		);
	});
});
