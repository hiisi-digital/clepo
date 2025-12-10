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
  /** An internal error that indicates a bug in clepo itself. */
  Internal,
}

/**
 * A structured error type for all failures within the clepo library.
 *
 * It contains a `kind` property to allow for robust, programmatic error handling,
 * and a user-friendly `message` that can be displayed directly to the end-user.
 */
export class ClepoError extends Error {
  /**
   * Creates a new ClepoError.
   * @param kind The kind of error.
   * @param message The user-friendly error message.
   * @param command The command context in which the error occurred, if available.
   */
  constructor(
    public readonly kind: ErrorKind,
    public override readonly message: string,
    public readonly command?: Command,
  ) {
    super(message);
    this.name = "ClepoError";

    // This is a standard way to make custom errors work correctly with `instanceof`.
    Object.setPrototypeOf(this, ClepoError.prototype);
  }
}
