export const ExitCode = {
  Ok: 0,
  Error: 1,
  InternalError: 2,
} as const

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]

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
    super(message, ExitCode.InternalError)
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
