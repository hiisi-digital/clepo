import type { Context } from "./context.ts";

/**
 * Defines the behavior to be taken when an argument is encountered by the parser.
 */
export enum ArgAction {
  /**
   * Stores a single value. This is the default action for most arguments.
   * @example --name "Alice"
   */
  Set = "set",
  /**
   * Appends a value to a list. Can be used multiple times.
   * @example --item 1 --item 2
   */
  Append = "append",
  /**
   * Stores `true` if the flag is present.
   * @example --verbose
   */
  SetTrue = "setTrue",
  /**
   * Stores `false` if the flag is present.
   * @example --no-color
   */
  SetFalse = "setFalse",
  /**
   * Increments a counter each time the flag is present.
   * @example -vvv
   */
  Count = "count",
  /**
   * Prints the help message and exits.
   * @example --help
   */
  Help = "help",
  /**
   * Prints the version message and exits.
   * @example --version
   */
  Version = "version",
}

/**
 * A function that takes a raw string argument from the command line
 * and parses it into a specific type, potentially throwing an error if validation fails.
 * @template T The type to parse the string into.
 */
// deno-lint-ignore no-explicit-any
export type ValueParser<T = any> = (value: string) => T;

/**
 * Configuration for a command-line argument (a flag, option, or positional).
 * This interface is used with the `@Arg` decorator.
 */
export interface Arg {
  /**
   * The unique identifier for this argument.
   * Usually corresponds to the property name on the class.
   */
  id?: string;

  /**
   * The short flag character (e.g. 'v' for -v).
   */
  short?: string;

  /**
   * The long flag name (e.g. 'verbose' for --verbose).
   * If set to `true`, the property name will be used (kebab-cased).
   */
  long?: string | boolean;

  /**
   * Short description shown in help.
   */
  help?: string;

  /**
   * Longer description shown in detailed help.
   */
  longHelp?: string;

  /**
   * Environment variable to check if the flag is not present.
   */
  env?: string;

  /**
   * Whether this argument is required.
   */
  required?: boolean;

  /**
   * The default value if not provided.
   */
  default?: unknown;

  /**
   * The expected type of the argument.
   * Used for basic parsing if no `valueParser` is provided.
   */
  type?: "string" | "number" | "boolean" | "list";

  /**
   * The action to take when the argument is encountered.
   * Defaults are inferred from the property type (e.g. boolean -> SetTrue).
   */
  action?: ArgAction;

  /**
   * Custom parser/validator for the value.
   */
  valueParser?: ValueParser;

  /**
   * Limit valid values to this set.
   */
  possibleValues?: string[];

  /**
   * Propagate this argument to subcommands.
   */
  global?: boolean;

  /**
   * Explicit index for positional arguments.
   * If omitted, arguments without flags are positional by declaration order.
   */
  index?: number;
}

/**
 * Configuration for a command or subcommand.
 * This interface is used with the `@Command` decorator.
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
  
  /**
   * If true, the version flag will be available on subcommands.
   */
  propagateVersion?: boolean;

  /**
   * Manually registered subcommands (constructors).
   * Prefer using @Subcommand decorator.
   */
  // deno-lint-ignore no-explicit-any
  subcommands?: (new () => any)[];

  // TODO: Add support for external subcommands if needed
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
 * Internal metadata collected from decorators about a command class.
 * This is used by the parser to build the CLI structure.
 */
export interface CommandMetadata {
  /** The constructor of the command class. */
  // deno-lint-ignore no-explicit-any
  cls: new () => any;
  /** The configuration object passed to the `@Command` decorator. */
  config: CommandConfig;
  /** A map of property names to their `@Arg` configurations. */
  args: Map<string, Arg>; // Key is property name
  /** A map of subcommand names/aliases to their metadata. */
  subcommands: Map<string, CommandMetadata>;
  /** A reference to the parent command's metadata, if this is a subcommand. */
  parent?: CommandMetadata;
}

/**
 * A collection of interactive helper functions available on the `Context`.
 */
export interface Helper {
  /**
   * Prompts the user for a yes/no confirmation.
   * @param msg The message to display to the user.
   */
  confirm(msg: string): Promise<boolean>;
  /**
   * Prompts the user for a line of text input.
   * @param msg The message to display to the user.
   * @param defaultValue A default value if the user provides no input.
   */
  prompt(msg: string, defaultValue?: string): Promise<string>;
}
