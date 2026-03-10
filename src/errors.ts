export class CliError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = 1) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function fail(code: string, message: string, exitCode = 1): never {
  throw new CliError(code, message, exitCode);
}
