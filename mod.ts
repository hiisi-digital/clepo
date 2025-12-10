// loru/packages/clepo/mod.ts

/**
 * The main entry point for the clepo library.
 *
 * This module exports the primary interfaces for building a command-line
 * application, supporting two distinct, first-class paradigms inspired by Rust's
 * `clap` crate:
 *
 * 1.  **The Builder API**: For dynamic or complex scenarios, you can imperatively
 *     build a CLI by instantiating the `Command` class and chaining methods like
 *     `.arg()` and `.subcommand()`.
 *
 * 2.  **The Decorator API**: For most use cases, you can declaratively define a
 *     CLI using TypeScript decorators (`@Command`, `@Arg`, etc.) on classes and
 *     properties. The `Cli.run()` function is the entry point for this paradigm.
 *
 * @module
 */

// --- Imports from internal modules ---
import { getCommand } from "./decorators.ts";
import type { Command as CommandBuilder } from "./command.ts";

// --- Re-exports for Public API ---

// Core builder class (for the Builder API)
export { Command } from "./command.ts";

// Decorators (for the Decorator API)
// The `@Command` decorator is renamed to avoid a name clash with the `Command` class.
export {
  Arg,
  Command as CommandDecorator,
  Subcommand,
  ValueEnum,
} from "./decorators.ts";

// Essential types for consumers
export type { CommandInstance } from "./command.ts";
export type { Context } from "./types.ts";
export { ArgAction } from "./arg.ts";
export { CommandSettings } from "./command.ts";
export { ClepoError, ErrorKind } from "./error.ts";

/**
 * Provides the entry point for the decorator-based API.
 */
export const Cli: {
  run(commandClass: new () => unknown): Promise<void>;
} = {
  /**
   * Parses command-line arguments and runs the command defined by a decorated class.
   *
   * This function serves as the bridge between the decorator-defined configuration
   * and the underlying execution engine. It retrieves the fully configured
   * `Command` instance associated with the class and executes its `run()` method.
   *
   * @param commandClass The main class, decorated with `@CommandDecorator`, that defines the CLI.
   * @example
   * ```typescript
   * // main.ts
   * import { Cli, CommandDecorator, CommandInstance, Context } from "clepo";
   *
   * @CommandDecorator({ name: "greet", version: "1.0" })
   * class Greet implements CommandInstance {
   *   async run(ctx: Context): Promise<void> {
   *     console.log("Hello, world!");
   *   }
   * }
   *
   * if (import.meta.main) {
   *   await Cli.run(Greet);
   * }
   * ```
   */
  async run(commandClass: new () => unknown): Promise<void> {
    const command: CommandBuilder = getCommand(commandClass);
    await command.run();
  },
};
