import { describe, it, expect, afterEach } from "bun:test";
import { canPrompt } from "../src/core/interactive";

// Commands used to gate their prompts on `process.stdout.isTTY` alone. Under
// `gram import … < /dev/null` — or any scripted run with stdin piped — stdout
// is still a terminal, so the prompt rendered and then waited forever on input
// that could never arrive. Both ends have to be a terminal.

const original = {
	stdin: process.stdin.isTTY,
	stdout: process.stdout.isTTY,
};

function withTty(stdin: boolean, stdout: boolean, fn: () => void) {
	process.stdin.isTTY = stdin;
	process.stdout.isTTY = stdout;
	try {
		fn();
	} finally {
		process.stdin.isTTY = original.stdin;
		process.stdout.isTTY = original.stdout;
	}
}

describe("canPrompt", () => {
	afterEach(() => {
		process.stdin.isTTY = original.stdin;
		process.stdout.isTTY = original.stdout;
	});

	it("allows prompting when both ends are a terminal", () => {
		withTty(true, true, () => expect(canPrompt()).toBe(true));
	});

	it("refuses when stdin is redirected, even though stdout is a terminal", () => {
		withTty(false, true, () => expect(canPrompt()).toBe(false));
	});

	it("refuses when stdout is piped", () => {
		withTty(true, false, () => expect(canPrompt()).toBe(false));
	});

	it("refuses when neither end is a terminal", () => {
		withTty(false, false, () => expect(canPrompt()).toBe(false));
	});
});
