// loru/packages/clepo/types.ts

/**
 * A collection of interactive helper functions available on the `Context`.
 * These are used to prompt the user for input or confirmation.
 */
export interface Helper {
  /**
   * Prompts the user for a yes/no confirmation.
   * @param msg The message to display to the user.
   * @returns A promise that resolves to `true` if the user confirms, otherwise `false`.
   */
  confirm(msg: string): Promise<boolean>;

  /**
   * Prompts the user for a line of text input.
   * @param msg The message to display to the user.
   * @param defaultValue A default value to return if the user provides no input.
   * @returns A promise that resolves to the user's input string.
   */
  prompt(msg: string, defaultValue?: string): Promise<string>;
}

/**
 * The execution context passed to a command's `run` method.
 * It provides a standardized interface for a command to interact with the outside
 * world, including I/O streams, environment variables, and interactive helpers.
 */
export interface Context {
  /**
   * Raw command-line arguments passed to the application.
   */
  readonly args: string[];

  /**
   * Environment variables available to the application.
   */
  readonly env: Record<string, string>;

  /**
   * The standard output stream, for writing primary output.
   */
  readonly stdout: WritableStream<Uint8Array>;

  /**
   * The standard error stream, for writing errors and diagnostics.
   */
  readonly stderr: WritableStream<Uint8Array>;

  /**
   * The standard input stream, for reading user input.
   */
  readonly stdin: ReadableStream<Uint8Array>;

  /**
   * A collection of interactive helper functions for prompting the user.
   */
  readonly helper: Helper;
}
