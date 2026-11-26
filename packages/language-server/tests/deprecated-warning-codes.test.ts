import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { allWarningInfo, warningInfoOf } from "@gram-lang/modules";

/*
 * The strikethrough of a diagnostic (`DiagnosticTag.Deprecated`) comes from
 * the `deprecated` flag of its code in kitchen's `warningInfo`, never from a
 * code written here. The flag and the registry say the same thing: every
 * active `syntax` entry's warning code is flagged, and every flagged code is
 * the warning code of an active entry.
 */

interface Entry {
	id: string;
	layer: string;
	status: string;
	warningCode?: string;
}

const registry = parse(
	readFileSync(join(import.meta.dir, "../../../deprecations.yaml"), "utf-8"),
) as { deprecations?: Entry[] } | Entry[];
const entries = Array.isArray(registry)
	? registry
	: (registry.deprecations ?? []);

describe("deprecated warning codes", () => {
	const active = entries.filter(
		(e) => e.status === "active" && e.warningCode !== undefined,
	);

	it("flags the warning code of every active entry", () => {
		expect(active.length).toBeGreaterThan(0);
		for (const entry of active) {
			expect({
				id: entry.id,
				deprecated: warningInfoOf(entry.warningCode!).deprecated,
			}).toEqual({ id: entry.id, deprecated: true });
		}
	});

	it("flags no code that is not the warning code of an active entry", () => {
		const codes = new Set(active.map((e) => e.warningCode));
		const flagged = allWarningInfo
			.filter((i) => i.deprecated)
			.map((i) => i.code);
		expect(flagged.filter((code) => !codes.has(code))).toEqual([]);
	});
});
