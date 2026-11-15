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
 * or `@use` line (`loc` only, in 021, 022, mod-016 and mod-017).
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
const TIMER_ADDED_SINCE_1_3_0 = new Set(["raw", "minutes"]);

// Added after 1.3.0 on any ingredient, reference or composite parent (1.5):
// the terms of a sum of quantities (`{1 cup + 1 tbsp}`). A sum did not parse
// in 1.3.0, so no case of the tag has one; listed so a sum never moves a digest.
const QUANTITY_ADDED_SINCE_1_3_0 = new Set(["parts"]);

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value && typeof value === "object") {
		const isTimer = (value as { type?: unknown }).type === "timer";
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([k]) => !(isTimer && TIMER_ADDED_SINCE_1_3_0.has(k)))
			.filter(([k]) => !QUANTITY_ADDED_SINCE_1_3_0.has(k))
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
