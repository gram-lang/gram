import { log } from '@clack/prompts'

export const ExitCode = {
  Ok: 0,
  Error: 1,
  InternalError: 2,
} as const

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]

/** Safely extracts a display message from an unknown catch value. */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Global --verbose/--debug flag, set once in index.ts before any command runs.
// Not a per-command citty arg: it needs to work identically across every
// subcommand without duplicating its definition 15+ times.
let verbose = false

export function setVerbose(value: boolean): void {
  verbose = value
}

export function isVerbose(): boolean {
  return verbose
}

/**
 * Reports a caught error the way most commands do: a terse message by
 * default, plus the full stack trace when --verbose/--debug was passed.
 */
export function reportError(err: unknown): void {
  log.error(getErrorMessage(err))
  if (verbose && err instanceof Error && err.stack) {
    console.error(err.stack)
  }
}

export class GramCLIError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode = ExitCode.InternalError,
  ) {
    super(message)
    this.name = 'GramCLIError'
  }
}

export class GramConfigError extends GramCLIError {
  constructor(message: string) {
    // A bad config/database is a user error, not an internal crash —
    // ExitCode.Error (1), not InternalError (2).
    super(message, ExitCode.Error)
    this.name = 'GramConfigError'
  }
}

export class GramParseError extends GramCLIError {
  constructor(
    message: string,
    public readonly file: string,
    public readonly line?: number,
  ) {
    super(message, ExitCode.Error)
    this.name = 'GramParseError'
  }
}
