import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The scheduler sits below kitchen: it must never import it (nor the parser),
// directly or through a relative path out of the package.
describe("package boundaries", () => {
	it("imports nothing from the packages that depend on it", () => {
		const dir = join(import.meta.dir, "../src");
		const offenders = readdirSync(dir)
			.filter((f) => f.endsWith(".ts"))
			.filter((f) =>
				/from\s+["'](@gram-lang\/|\.\.\/)/.test(
					readFileSync(join(dir, f), "utf8"),
				),
			);
		expect(offenders).toEqual([]);
	});
});
