import { describe, expect, it } from "bun:test";
import { commandLineAnswer, hasTransportFlag } from "../src/transport";

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

describe("commandLineAnswer", () => {
	it("prints the version for --version and -v", () => {
		expect(commandLineAnswer(["--version"], "1.6.0")).toBe("1.6.0\n");
		expect(commandLineAnswer(["-v"], "1.6.0")).toBe("1.6.0\n");
	});

	it("prints the usage for --help and -h", () => {
		for (const flag of ["--help", "-h"]) {
			const help = commandLineAnswer([flag], "1.6.0");
			expect(help).toStartWith("gram-language-server 1.6.0\n");
			expect(help).toContain("--stdio");
			expect(help).toContain("--version");
		}
	});

	it("starts the server otherwise", () => {
		expect(commandLineAnswer([], "1.6.0")).toBeUndefined();
		expect(commandLineAnswer(["--stdio"], "1.6.0")).toBeUndefined();
		expect(commandLineAnswer(["lsp", "--node-ipc"], "1.6.0")).toBeUndefined();
	});
});
