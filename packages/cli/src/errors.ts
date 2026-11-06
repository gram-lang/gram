import { log } from "@clack/prompts";

export const ExitCode = {
	Ok: 0,
	Error: 1,
	InternalError: 2,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export function getErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

// Global --verbose/--debug flag, set once in index.ts before any command runs.
// Not a per-command citty arg: it needs to work identically across every
// subcommand without duplicating its definition 15+ times.
let verbose = false;

export function setVerbose(value: boolean): void {
	verbose = value;
}

export function isVerbose(): boolean {
	return verbose;
}

/**
 * Reports a caught error the way most commands do: a terse message by
 * default, plus the full stack trace when --verbose/--debug was passed.
 */
export function reportError(err: unknown): void {
	log.error(getErrorMessage(err));
	if (verbose && err instanceof Error && err.stack) {
		console.error(err.stack);
	}
}

/**
 * Ends a command on an error it caught, the same way in every command: its
 * message on one line, never a stack trace unless --verbose/--debug was
 * passed. A `GramCLIError` exits with its own code; anything else (an engine
 * refusing its input, a bug) with `ExitCode.Error`. `report` writes the
 * message, for a command that prints it its own way (raw output on stderr, a
 * styled stream).
 */
export function exitOnError(
	err: unknown,
	report: (message: string) => void = (message) => log.error(message),
): never {
	report(getErrorMessage(err));
	if (verbose && !(err instanceof GramCLIError) && err instanceof Error) {
		if (err.stack) console.error(err.stack);
	}
	return process.exit(
		err instanceof GramCLIError ? err.exitCode : ExitCode.Error,
	);
}

export class GramCLIError extends Error {
	constructor(
		message: string,
		public readonly exitCode: ExitCode = ExitCode.InternalError,
	) {
		super(message);
		this.name = "GramCLIError";
	}
}

export class GramConfigError extends GramCLIError {
	constructor(message: string) {
		// A bad config/database is a user error, not an internal crash —
		// ExitCode.Error (1), not InternalError (2).
		super(message, ExitCode.Error);
		this.name = "GramConfigError";
	}
}
