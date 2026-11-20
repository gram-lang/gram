import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Nothing published in 1.3.0 may change before 2.0.0. `legacy-1.3.0.json` holds
 * a digest of the compiled JSON each conformance case produced at the `v.1.3.0`
 * tag (keys sorted, so only a real change moves it). The fields added since are
 * left out of the comparison; every other field has to come out byte for byte
 * as it did.
 *
 * If this fails, read the difference against the tag before anything else:
 *   git show v.1.3.0:conformance/cases/<case>/compiled.json
 * A fix that changes a value without changing its meaning (PR #47 did, for the
 * intermediates' overhead) is the only legitimate reason to regenerate a digest,
 * and the case must be named in the pull request. 1.5 did too: a section
 * anchor's warnings point at the anchor itself, no longer at the whole section
 * or `@use` line (`loc` only, in 021, 022, mod-016 and mod-017). And a unit
 * written with no number is no longer lost from the shopping list: its entry
 * lists it in `variable_entries` (026, `{1/0 cups}`, whose fraction has no
 * value). That fraction now raises an `INVALID_QUANTITY` warning, where it
 * used to vanish without a word (026 again, `warnings` only). And the
 * goldens no longer carry the analyzer's warnings, which `analyze()` used to
 * add to the compiled result it was given (the compiler never raised them:
 * warn-001, warn-002, warn-009, warn-010 and warn-011, `warnings` only).
 *
 * The digests come from the tag's goldens: `canonical(json)` below, sha256, hex.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, "cases");

// Added after 1.3.0: the graph and the timeline, and the fields they replace.
const ADDED_SINCE_1_3_0 = new Set([
	"generator",
	"miseEnPlace",
	"tasks",
	"schedule",
	"schedules",
]);

// Added after 1.3.0 inside a step's timer token (1.5): what was written and
// the duration in minutes.
// And a proportional time's ratio (1.5): a ratio did not parse in 1.3.0, so
// no case of the tag has one; listed so a ratio never moves a digest.
const TIMER_ADDED_SINCE_1_3_0 = new Set(["raw", "minutes", "ratio"]);

// Added after 1.3.0 inside a step's temperature token (1.5): the note glued
// to its brace (`^{160°C}(fan)`). Left out when absent, so no case of the tag
// moves; listed so a note never moves a digest.
const TEMPERATURE_ADDED_SINCE_1_3_0 = new Set(["note"]);

// Added after 1.3.0 on any ingredient, reference or composite parent (1.5):
// the terms of a sum of quantities (`{1 cup + 1 tbsp}`). A sum did not parse
// in 1.3.0, so no case of the tag has one; listed so a sum never moves a digest.
const QUANTITY_ADDED_SINCE_1_3_0 = new Set(["parts"]);

// Added after 1.3.0 on a shopping entry (1.5): the bounds of a total with a
// range in it, next to its middle in `qty`. Left out only next to a numeric
// `qty`: a range quantity object (`{ type: "range", range }`) keeps its own.
const isShoppingRange = (value: object, key: string): boolean =>
	key === "range" && typeof (value as { qty?: unknown }).qty === "number";

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value && typeof value === "object") {
		const type = (value as { type?: unknown }).type;
		const isTimer = type === "timer";
		const isTemperature = type === "temperature";
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([k]) => !(isTimer && TIMER_ADDED_SINCE_1_3_0.has(k)))
			.filter(([k]) => !(isTemperature && TEMPERATURE_ADDED_SINCE_1_3_0.has(k)))
			.filter(([k]) => !QUANTITY_ADDED_SINCE_1_3_0.has(k))
			.filter(([k]) => !isShoppingRange(value, k))
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
		return `{${entries.join(",")}}`;
	}
	return JSON.stringify(value);
}

const digestOf = (compiled: Record<string, unknown>) =>
	createHash("sha256")
		.update(
			canonical(
				Object.fromEntries(
					Object.entries(compiled).filter(([k]) => !ADDED_SINCE_1_3_0.has(k)),
				),
			),
		)
		.digest("hex");

const digests = JSON.parse(
	readFileSync(join(HERE, "legacy-1.3.0.json"), "utf-8"),
) as Record<string, string>;

describe("what 1.3.0 published", () => {
	it("covers a substantial corpus", () => {
		expect(Object.keys(digests).length).toBeGreaterThan(50);
	});

	for (const [name, digest] of Object.entries(digests)) {
		it(`is unchanged for ${name}`, () => {
			const file = join(CASES_DIR, name, "compiled.json");
			expect(existsSync(file)).toBe(true);
			expect(digestOf(JSON.parse(readFileSync(file, "utf-8")))).toBe(digest);
		});
	}
});
