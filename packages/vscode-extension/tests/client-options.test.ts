import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	CONFIGURATION_SECTION,
	createClientOptions,
} from "../src/client-options";

describe("language client options", () => {
	it("tells the server when a gram.* setting changes", () => {
		// Without `synchronize.configurationSection` the client never sends
		// workspace/didChangeConfiguration, so changing gram.miseEnPlace in the
		// settings left the preview and the Gantt chart untouched.
		expect(createClientOptions().synchronize?.configurationSection).toBe(
			"gram",
		);
	});

	it("uses the same section the settings are declared under", () => {
		const manifest = JSON.parse(
			readFileSync(join(import.meta.dir, "..", "package.json"), "utf-8"),
		);
		const keys = Object.keys(manifest.contributes.configuration.properties);
		expect(keys.length).toBeGreaterThan(0);
		for (const key of keys) {
			expect(key.startsWith(`${CONFIGURATION_SECTION}.`)).toBe(true);
		}
	});

	it("still selects gram files", () => {
		expect(createClientOptions().documentSelector).toEqual([
			{ scheme: "file", language: "gram" },
		]);
	});
});
