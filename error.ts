// loru/packages/clepo/error.ts

import type { Command } from "./command.ts";

/**
 * The specific kind of error that occurred.
 *
 * This allows consumers to programmatically handle different error types
 * without relying on parsing the error message string. It is the TypeScript
 * equivalent of `clap::error::ErrorKind`.
 */
export enum ErrorKind {
  /** A required argument was not provided. */
  MissingRequiredArgument,
  /** An argument was provided that was not recognized. */
  UnknownArgument,
  /** An argument's value could not be parsed or validated. */
  InvalidArgumentValue,
  /** The user provided a flag that requires a value, but did not provide one. */
  MissingValue,
  /** An unexpected argument was provided. */
  UnexpectedArgument,
  /** A required subcommand was not provided. */
  MissingSubcommand,
  /** Arguments conflict with each other. */
  ArgumentConflict,
  /** An internal error that indicates a bug in clepo itself. */
  Internal,
}

/**
 * A structured error type for all failures within the clepo library.
 *
 * It contains a `kind` property to allow for robust, programmatic error handling,
 * and a user-friendly `message` that can be displayed directly to the end-user.
 *
 * @example
 * ```typescript
 * try {
 *   await Cli.run(MyCommand);
 * } catch (e) {
 *   if (e instanceof ClepoError) {
 *     switch (e.kind) {
 *       case ErrorKind.MissingRequiredArgument:
 *         console.error("Missing required argument:", e.message);
 *         break;
 *       case ErrorKind.InvalidArgumentValue:
 *         console.error("Invalid value:", e.message);
 *         break;
 *       default:
 *         console.error("Error:", e.message);
 *     }
 *   }
 * }
 * ```
 */
export class ClepoError extends Error {
  /**
   * The name of the error class, always "ClepoError".
   */
  public override readonly name = "ClepoError";

  /**
   * Creates a new ClepoError.
   * @param kind The kind of error, used for programmatic error handling.
   * @param message The user-friendly error message to display.
   * @param command The command context in which the error occurred, if available.
   */
  constructor(
    public readonly kind: ErrorKind,
    public override readonly message: string,
    public readonly command?: Command,
  ) {
    super(message);

    // This is a standard way to make custom errors work correctly with `instanceof`.
    Object.setPrototypeOf(this, ClepoError.prototype);
  }

  /**
   * Returns a formatted error string suitable for display to end users.
   * Includes the command context if available.
   */
  public format(): string {
    const prefix = this.command ? `${this.command.name}: ` : "";
    return `error: ${prefix}${this.message}`;
  }

  /**
   * Returns a string representation of the error kind for debugging.
   */
  public kindName(): string {
    return ErrorKind[this.kind];
  }
}
