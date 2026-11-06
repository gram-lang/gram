import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SETTINGS } from "@gram-lang/renderer";

/*
 * Every setting of the renderer's descriptors is a `gram.*` key of the editor,
 * with the same values and the same default, and every `gram.*` key is a
 * setting (or one of the few keys that are not, listed below). The manifest is
 * not generated, so this is what keeps the two from drifting.
 *
 * The CLI side is checked in the CLI's own `settings-parity.test.ts`, the
 * playground side in `settingsStorage.test.ts`.
 */

interface ManifestProperty {
	type: string;
	enum?: string[];
	default: unknown;
	description?: string;
}

const manifest = JSON.parse(
	readFileSync(
		join(import.meta.dir, "..", "..", "vscode-extension", "package.json"),
		"utf-8",
	),
);
const properties: Record<string, ManifestProperty> =
	manifest.contributes.configuration.properties;

/**
 * `gram.*` keys that are not settings of a recipe: where the ingredient
 * database is. The inputs of one session (the serving time, the scale, the
 * stock, the baker's reference) are never `gram.*` keys at all.
 */
const NOT_SETTINGS = new Set(["gram.ingredientDatabase.path"]);

describe("the editor's gram.* keys and the setting descriptors", () => {
	for (const setting of SETTINGS) {
		const key = `gram.${setting.key}`;
		it(`${key} exists, with the setting's values and default`, () => {
			const property = properties[key];
			expect(property).toBeDefined();
			expect(property?.default).toEqual(setting.default);
			expect(property?.description?.length).toBeGreaterThan(0);
			if (setting.type === "choice") {
				expect(property?.type).toBe("string");
				expect(property?.enum).toEqual([...setting.values]);
			} else {
				expect(property?.type).toBe("boolean");
			}
		});
	}

	it("has no gram.* key that is not a setting, but the known ones", () => {
		const settingKeys = new Set(SETTINGS.map((s) => `gram.${s.key}`));
		const strays = Object.keys(properties).filter(
			(key) => !settingKeys.has(key) && !NOT_SETTINGS.has(key),
		);
		expect(strays).toEqual([]);
	});
});
