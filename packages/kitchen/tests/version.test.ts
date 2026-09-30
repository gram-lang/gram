import { describe, expect, it } from "bun:test";
import pkg from "../package.json";
import { KITCHEN_VERSION } from "../src/version";

describe("KITCHEN_VERSION", () => {
	// `src/version.ts` is generated at build time: a release whose build didn't
	// regenerate it would ship (and stamp compiled JSON with) the previous version.
	it("matches the version in package.json", () => {
		expect(KITCHEN_VERSION).toBe(pkg.version);
	});
});
