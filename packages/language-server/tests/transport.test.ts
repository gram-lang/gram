import { describe, expect, it } from "bun:test";
import { hasTransportFlag } from "../src/transport";

describe("hasTransportFlag", () => {
	it("sees each transport the library reads", () => {
		expect(hasTransportFlag(["--stdio"])).toBe(true);
		expect(hasTransportFlag(["--node-ipc"])).toBe(true);
		expect(hasTransportFlag(["--socket", "5007"])).toBe(true);
		expect(hasTransportFlag(["--socket=5007"])).toBe(true);
		expect(hasTransportFlag(["--pipe", "/tmp/gram.sock"])).toBe(true);
		expect(hasTransportFlag(["--pipe=/tmp/gram.sock"])).toBe(true);
	});

	it("finds it among other arguments", () => {
		expect(hasTransportFlag(["--clientProcessId=42", "--node-ipc"])).toBe(true);
		expect(hasTransportFlag(["lsp", "--stdio"])).toBe(true);
	});

	it("sees none on an empty or unrelated command line", () => {
		expect(hasTransportFlag([])).toBe(false);
		expect(hasTransportFlag(["lsp"])).toBe(false);
		expect(hasTransportFlag(["--clientProcessId=42"])).toBe(false);
		expect(hasTransportFlag(["--stdio-like", "--socketed=1"])).toBe(false);
	});
});
