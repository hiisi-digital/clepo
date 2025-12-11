// loru/packages/clepo/mod.ts

/**
 * The main entry point for the clepo library.
 *
 * This module exports the primary interfaces for building a command-line
 * application, supporting two distinct, first-class paradigms inspired by Rust's
 * `clap` crate:
 *
 * 1.  **The Builder API**: For dynamic or complex scenarios, you can imperatively
 *     build a CLI by instantiating the `CommandBuilder` class and chaining methods
 *     like `.addArg()` and `.addSubcommand()`.
 *
 * 2.  **The Decorator API**: For most use cases, you can declaratively define a
 *     CLI using TypeScript decorators (`@Command`, `@Arg`, etc.) on classes and
 *     properties. The `Cli.run()` function is the entry point for this paradigm.
 *
 * Also provides built-in value parsers and utility functions for common use cases.
 *
 * @module
 */

// --- Imports from internal modules ---
import type { Command as CommandBuilderType } from "./command.ts";
import { getCommand } from "./decorators.ts";

// =============================================================================
// Builder API Exports
// =============================================================================

/**
 * The core Command builder class for imperatively constructing CLI commands.
 * Use this when you need dynamic command construction at runtime.
 *
 * @example
 * ```typescript
 * const cmd = new CommandBuilder("greet")
 *   .setVersion("1.0.0")
 *   .addArg(new ArgBuilder({ id: "name", required: true }));
 * ```
 */
export { Command as CommandBuilder } from "./command.ts";

/**
 * The Arg class for defining individual arguments in the builder API.
 */
export { Arg as ArgBuilder } from "./arg.ts";

/**
 * Enum defining the behavior when an argument is encountered.
 */
export { ArgAction } from "./arg.ts";

/**
 * Built-in value parser for "boolish" values (yes/no, on/off, true/false, 1/0).
 */
export { parseBoolish } from "./arg.ts";

/**
 * Factory for creating ranged integer parsers.
 */
export { createRangedParser } from "./arg.ts";

/**
 * Type for built-in value parser identifiers.
 */
export type { BuiltinValueParser } from "./arg.ts";

/**
 * Flags to control command behavior.
 */
export { CommandSettings } from "./command.ts";

// =============================================================================
// Decorator API Exports
// =============================================================================

/**
 * The `@Command` class decorator for marking a class as a CLI command.
 *
 * @example
 * ```typescript
 * @Command({ name: "greet", version: "1.0.0" })
 * class GreetCli {
 *   @Arg({ short: "n", long: "name", required: true })
 *   name!: string;
 *
 *   async run() {
 *     console.log(`Hello, ${this.name}!`);
 *   }
 * }
 * ```
 */
export { Command } from "./decorators.ts";

/**
 * The `@Arg` property decorator for defining command-line arguments.
 */
export { Arg } from "./decorators.ts";

/**
 * The `@Subcommand` property decorator for registering subcommand classes.
 */
export { Subcommand } from "./decorators.ts";

/**
 * Factory function for creating a subcommand "enum" from command classes.
 * This provides a clap-like API where the type is automatically inferred as a union.
 *
 * @example
 * ```typescript
 * const Commands = Subcommands(Clone, Diff, Add);
 *
 * @Command({ name: "git" })
 * class GitCli {
 *   command = Commands;  // Type is Clone | Diff | Add
 * }
 * ```
 */
export { Subcommands } from "./decorators.ts";

/**
 * The marker type returned by the `Subcommands()` function.
 * Useful for type annotations when needed.
 */
export type { SubcommandsMarker, SubcommandsResult } from "./decorators.ts";

/**
 * The `@ValueEnum` property decorator for restricting values to an enum.
 */
export { ValueEnum } from "./decorators.ts";

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Interface that command classes must implement.
 */
export type { CommandInstance } from "./command.ts";

/**
 * Configuration options for the `@Command` decorator.
 */
export type { CommandConfig } from "./command.ts";

/**
 * The execution context passed to command's run() method.
 */
export type { Context } from "./types.ts";

/**
 * Helper interface for interactive prompts.
 */
export type { Helper } from "./types.ts";

// =============================================================================
// Error Handling
// =============================================================================

/**
 * The custom error class for clepo-related failures.
 */
export { ClepoError } from "./error.ts";

/**
 * Enum of specific error kinds for programmatic error handling.
 */
export { ErrorKind } from "./error.ts";

// =============================================================================
// CLI Entry Point
// =============================================================================

/**
 * The interface for the CLI entry point object.
 */
export interface CliInterface {
  /**
   * Parses command-line arguments and runs the command defined by a decorated class.
   * @param commandClass The main class, decorated with `@Command`, that defines the CLI.
   */
  run(commandClass: new () => unknown): Promise<void>;
}

/**
 * Provides the entry point for the decorator-based API.
 *
 * @example
 * ```typescript
 * import { Arg, Cli, Command } from "@loru/clepo";
 *
 * @Command({ name: "greet", version: "1.0.0" })
 * class Greet {
 *   @Arg({ short: "n", long: "name", required: true })
 *   name!: string;
 *
 *   async run() {
 *     console.log(`Hello, ${this.name}!`);
 *   }
 * }
 *
 * if (import.meta.main) {
 *   await Cli.run(Greet);
 * }
 * ```
 */
export const Cli: CliInterface = {
  async run(commandClass: new () => unknown): Promise<void> {
    const command: CommandBuilderType = getCommand(commandClass);
    await command.run();
  },
};
