import { describe, expect, it } from "bun:test";
import { compile } from "@gram-lang/kitchen";
import { getAST } from "@gram-lang/parser";
import { project } from "@gram-lang/scheduler";
import { toGanttHTML } from "../src/index";

const BREAD = `## Dough ->&dough

[Mix] Mix @flour{500g} with @water{350ml} and knead ~{20min}.

[Rise] Let it rise ~_{8-16h}.

## Bake

[Bake] Shape &dough{850g} and bake at ^{230C} for ~{30min}.
`;

const compiled = compile(getAST(BREAD));
const plan = (patch = {}, c = compiled) =>
	project([{ graph: c.tasks }], {
		serveAt: "2026-10-11T13:00",
		timeZone: "Europe/Paris",
		availability: { daily: [{ start: "08:00", end: "22:00" }] },
		...patch,
	});

describe("rests", () => {
	it("follow the choice on the chart, as in the other outputs", () => {
		const total = (rests: "shortest" | "longest") =>
			Number(
				/data-max-real-time="(\d+)"/.exec(toGanttHTML(compiled, { rests }))![1],
			);
		expect(total("longest") - total("shortest")).toBe(16 * 60 - 8 * 60);
	});
});

describe("a projected chart", () => {
	const html = toGanttHTML(compiled, { projection: plan() });

	it("is marked as placed on the calendar", () => {
		expect(html).toContain('data-projected="true"');
		expect(toGanttHTML(compiled)).not.toContain("data-projected");
	});

	it("draws the stretched rest at its new length", () => {
		// 8 h stretched to 14 h 30: 870 minutes, plus the preparation before it.
		expect(html).toMatch(/data-duration="870"/);
		expect(html).toContain("adjusted");
		expect(html).toContain("Rest changed from 8h to 14h30");
	});

	it("reads the axis in days and clock times of the plan's zone", () => {
		const labels = [
			...html.matchAll(/<div class="tick-label">([^<]*)<\/div>/g),
		].map((m) => m[1]!);
		expect(labels[0]).toMatch(/^Sat,? 21:3\d$|^Sat 21:\d\d$/);
		expect(labels.at(-1)).toMatch(/Sun,? 13:00/);
		expect(html).toContain('data-fixed-label="true"');
	});

	it("keeps the time modes for a chart that is not projected only", () => {
		expect(html).not.toContain("time-select");
		expect(toGanttHTML(compiled)).toContain("time-select");
		expect(html).toContain("compact-toggle");
	});

	it("greys out the hours the cook is not available", () => {
		expect(html).toContain('class="unavailable-band"');
		expect(html).toContain('title="Not available"');
	});

	it("gives a block the wall clock for its tooltip", () => {
		expect(html).toMatch(/data-start-label="Sat,? 2\d:\d\d"/);
	});

	it("speaks the language asked for", () => {
		const fr = toGanttHTML(compiled, { projection: plan(), lang: "fr" });
		expect(fr).toContain('title="Indisponible"');
		expect(fr).toMatch(/Repos modifié de 8h à 14h30/);
		expect(fr).toMatch(/sam\.? 21:\d\d/);
	});

	it("does not depend on the choices it was not made with", () => {
		expect(
			toGanttHTML(compiled, { projection: plan(), rests: "longest" }),
		).toBe(html);
	});

	it("draws what the plan could not fix without hiding it: the work stays where it falls", () => {
		const exact = compile(getAST(BREAD.replace("~_{8-16h}", "~_{8h}")));
		const out = toGanttHTML(exact, { projection: plan({}, exact) });
		expect(out).not.toContain("adjusted");
		expect(out).toMatch(/Sun,? 04:/);
	});

	it("is empty for a plan without a recipe", () => {
		expect(
			toGanttHTML(compiled, { projection: plan({}, compile(getAST(""))) }),
		).toContain("empty-state");
	});
});
