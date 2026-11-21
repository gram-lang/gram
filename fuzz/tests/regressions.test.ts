import { describe, expect, it } from "bun:test";
import { regressions } from "../src/regressions";
import { checkInput } from "../src/run";

describe("fuzz regressions", () => {
	const cases = regressions();
	it.skipIf(cases.length > 0)("none yet", () => {});
	for (const { name, content } of cases) {
		it(name, () => {
			expect(checkInput(content).map((v) => v.signature)).toEqual([]);
		});
	}
});
