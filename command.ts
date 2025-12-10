// loru/packages/clepo/command.ts

import type { Arg } from "./arg.ts";
import { ClepoError } from "./error.ts";
import { HelpGenerator } from "./help.ts";
import { Parser } from "./parser.ts";
import type { Context } from "./types.ts";

/**
 * Flags that control the behavior of a command.
 * This is the TypeScript equivalent of `clap::AppSettings`.
 */
export enum CommandSettings {
  /** Enables the automatic `--help` flag. */
  HelpFlag = 1 << 0,
  /** Enables the automatic `--version` flag. */
  VersionFlag = 1 << 1,
  /** Propagates the version to all subcommands. */
  PropagateVersion = 1 << 2,
  /** Requires a subcommand to be present. */
  SubcommandRequired = 1 << 3,
  /** An argument is required if no subcommand is present. */
  ArgRequiredElseHelp = 1 << 4,
}

/**
 * Configuration for a command or subcommand.
 * This is used to initialize a `Command` instance.
 */
export interface CommandConfig {
  /** The name of the command, used to invoke it from the CLI. */
  name?: string;
  /** The version string, printed with `--version`. */
  version?: string;
  /** A short, one-line description of the command. */
  about?: string;
  /** A more detailed description, shown in the full help message. */
  longAbout?: string;
  /** Alternative names for a subcommand. */
  aliases?: string[];
  /** A list of settings to apply to the command. */
  settings?: CommandSettings[];
  // deno-lint-ignore no-explicit-any
  subcommands?: (new () => any)[];
}

/**
 * Represents an executable command class.
 * All command classes must implement this interface.
 */
export interface CommandInstance {
  /**
   * The main entry point for the command's logic.
   * @param ctx The execution context, providing access to I/O, environment, etc.
   */
  run(ctx: Context): Promise<void>;
}

/**
 * The central class for building a command-line interface.
 * It holds all the configuration and relationships for commands, subcommands, and arguments.
 * This is the TypeScript equivalent of `clap::Command`.
 */
export class Command {
  // --- Public Configuration ---
  public name: string;
  public version?: string;
  public about?: string;
  public longAbout?: string;
  public aliases?: string[];

  // --- Internal State ---
  // deno-lint-ignore no-explicit-any
  public cls?: new () => any;
  public parent?: Command;
  public args: Map<string, Arg> = new Map<string, Arg>(); // Key is property name
  public subcommands: Map<string, Command> = new Map<string, Command>(); // Key is subcommand name/alias
  /** The property on the parent class where the subcommand instance should be injected. */
  public subcommandProperty?: string;
  private settings: number = CommandSettings.HelpFlag |
    CommandSettings.VersionFlag;
  private isFinalized = false;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Sets the version of the command.
   */
  public setVersion(version: string): this {
    this.version = version;
    return this;
  }

  /**
   * Sets the short description of the command.
   */
  public setAbout(about: string): this {
    this.about = about;
    return this;
  }

  /**
   * Sets the long description of the command.
   */
  public setLongAbout(longAbout: string): this {
    this.longAbout = longAbout;
    return this;
  }

  /**
   * Adds an argument to the command.
   */
  public addArg(arg: Arg): this {
    if (!arg.id) {
      // This should be caught earlier, but as a safeguard.
      throw new Error("Argument must have an ID.");
    }
    this.args.set(arg.id, arg);
    return this;
  }

  /**
   * Adds a subcommand to the command.
   */
  public addSubcommand(subcommand: Command): this {
    subcommand.parent = this;
    this.subcommands.set(subcommand.name, subcommand);

    if (subcommand.aliases) {
      for (const alias of subcommand.aliases) {
        this.subcommands.set(alias, subcommand);
      }
    }
    return this;
  }

  /**
   * Enables a setting on the command.
   */
  public setting(setting: CommandSettings): this {
    this.settings |= setting;
    return this;
  }

  /**
   * Disables a setting on the command.
   */
  public unsetSetting(setting: CommandSettings): this {
    this.settings &= ~setting;
    return this;
  }

  /**
   * Checks if a setting is enabled.
   */
  public isSet(setting: CommandSettings): boolean {
    return (this.settings & setting) !== 0;
  }

  /**
   * Finalizes the command and subcommand tree.
   * This is a critical pre-computation step that propagates global arguments and settings
   * down the tree, preventing expensive lookups during the parsing hot path.
   * This should only be called once before parsing begins.
   */
  public finalize(): void {
    if (this.isFinalized) {
      return;
    }

    // Propagate properties from the parent command.
    if (this.parent) {
      // Propagate global arguments.
      for (const parentArg of this.parent.args.values()) {
        if (parentArg.global) {
          // The child's own argument definitions take precedence.
          if (!this.args.has(parentArg.id!)) {
            this.args.set(parentArg.id!, parentArg);
          }
        }
      }

      // Propagate version if the setting is enabled on the parent.
      if (
        this.parent.isSet(CommandSettings.PropagateVersion) &&
        this.parent.version
      ) {
        this.version = this.version ?? this.parent.version;
      }
    }

    // Once this command is finalized, recursively finalize its children.
    // We use a Set to handle aliases correctly and avoid finalizing the same subcommand multiple times.
    for (const subcommand of new Set(this.subcommands.values())) {
      subcommand.finalize();
    }

    this.isFinalized = true;
  }

  /**
   * Parses the given arguments and executes the matched command.
   *
   * This is the primary entry point for the Builder API. It encapsulates the
   * entire process of finalization, parsing, and execution, including
   * automatic help/version handling and graceful error reporting.
   *
   * @param args The command-line arguments to parse (defaults to `Deno.args`).
   * @param env The environment variables to use (defaults to `Deno.env`).
   */
  public async run(
    args: string[] = Deno.args,
    env: Record<string, string> = Deno.env.toObject(),
  ): Promise<void> {
    try {
      this.finalize();

      const parser = new Parser(this);
      const result = parser.parse(args, env);

      // Handle automatic help and version flags.
      if (result.helpRequested) {
        const help = new HelpGenerator(result.command).generate();
        console.log(help);
        Deno.exit(0);
      }
      if (result.versionRequested) {
        console.log(result.command.version ?? "N/A");
        Deno.exit(0);
      }

      // TODO: Build a real context object. For now, a placeholder.
      const context: Context = {
        args: args,
        env: env,
        stdout: Deno.stdout.writable,
        stderr: Deno.stderr.writable,
        stdin: Deno.stdin.readable,
        // deno-lint-ignore no-explicit-any
        helper: null as any, // Placeholder for now
      };

      // Execute the command's logic.
      await result.instance.run(context);
    } catch (e) {
      if (e instanceof ClepoError) {
        // Handle known parsing errors gracefully.
        console.error(`error: ${e.message}\n`);
        if (e.command) {
          console.error(
            `For more information, try '--help'.`,
          );
        }
        Deno.exit(1);
      } else {
        // Re-throw unexpected errors.
        throw e;
      }
    }
  }
}
