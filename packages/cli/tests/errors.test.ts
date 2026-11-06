import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { ExitCode, GramCLIError, exitOnError, setVerbose } from "../src/errors";

/**
 * What `exitOnError` said and the code it exited with. The message is read
 * through `report` rather than from the prompt library, which another test
 * file mocks for the whole run.
 */
function run(err: unknown) {
	const said: string[] = [];
	const stack: string[] = [];
	let code: number | undefined;
	const exit = spyOn(process, "exit").mockImplementation(((c?: number) => {
		code = c;
		throw new Error("exit");
	}) as never);
	const consoleError = spyOn(console, "error").mockImplementation(
		(s: unknown) => {
			stack.push(String(s));
		},
	);
	try {
		expect(() => exitOnError(err, (message) => said.push(message))).toThrow(
			"exit",
		);
	} finally {
		exit.mockRestore();
		consoleError.mockRestore();
	}
	return { code, said, stack: stack.join("") };
}

describe("exitOnError", () => {
	beforeEach(() => setVerbose(false));
	afterEach(() => setVerbose(false));

	it("ends on a GramCLIError with its message and its own exit code", () => {
		const { code, said, stack } = run(
			new GramCLIError("No recipe found.", ExitCode.Error),
		);
		expect(code).toBe(ExitCode.Error);
		expect(said).toEqual(["No recipe found."]);
		expect(stack).toBe("");
	});

	it("ends on any other error with a one-line message, never a stack trace", () => {
		const { code, said, stack } = run(
			new RangeError('"2026-02-30" is not a valid date'),
		);
		expect(code).toBe(ExitCode.Error);
		expect(said).toEqual(['"2026-02-30" is not a valid date']);
		expect(stack).toBe("");
	});

	it("adds the stack trace of an unexpected error with --verbose", () => {
		setVerbose(true);
		const { said, stack } = run(new RangeError("boom"));
		expect(said).toEqual(["boom"]);
		expect(stack).toContain("RangeError: boom");
		expect(stack).toContain("    at ");
	});

	it("keeps a GramCLIError to its message even with --verbose", () => {
		setVerbose(true);
		const { stack } = run(new GramCLIError("No files matched."));
		expect(stack).toBe("");
	});
});
