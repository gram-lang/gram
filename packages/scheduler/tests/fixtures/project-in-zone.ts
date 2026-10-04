// Prints the projection of a fixed recipe as JSON. The tests run it under
// several `TZ` values: the output must not depend on the machine's zone.
import { project } from "../../src/project";
import { runSheet } from "../../src/runsheet";
import type { TaskGraph } from "../../src/graph";

const graph: TaskGraph = {
	tasks: [
		{
			id: "s0.0",
			kind: "step",
			section: 0,
			step: 0,
			duration: { nominal: 20 },
			produces: ["dough"],
			after: [],
		},
		{
			id: "s0.0.t0",
			kind: "passive",
			section: 0,
			step: 0,
			offset: 20,
			duration: { nominal: 480, min: 480, max: 1500 },
			after: ["s0.0"],
		},
		{
			id: "s1.0",
			kind: "step",
			section: 1,
			step: 0,
			duration: { nominal: 30 },
			consumes: ["dough"],
			after: ["s0.0"],
		},
	],
	sections: [{ day: 1, intermediate: "dough" }, { day: 0 }],
};

const out = [];
for (const [timeZone, serveAt] of [
	["Europe/Paris", "2026-10-25T13:00"],
	["Europe/Paris", "2026-03-29T13:00"],
	["America/New_York", "2026-11-01T13:00"],
	["Asia/Kolkata", "2026-10-11T13:00"],
	["Pacific/Auckland", "2026-09-27T13:00"],
] as const) {
	const plan = project([{ graph, title: "Dough" }], {
		serveAt,
		timeZone,
		availability: {
			daily: [{ start: "08:00", end: "22:00" }],
			weekdays: { sat: [{ start: "10:00", end: "23:00" }] },
		},
		now: "2026-01-01T00:00:00Z",
	});
	out.push({ plan, sheet: runSheet(plan) });
}
console.log(JSON.stringify(out));
