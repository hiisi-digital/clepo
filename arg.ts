// loru/packages/clepo/arg.ts

/**
 * A function that takes a raw string argument from the command line
 * and parses it into a specific type, potentially throwing an error if validation fails.
 * @template T The type to parse the string into.
 */
// deno-lint-ignore no-explicit-any
export type ValueParser<T = any> = (value: string) => T;

/**
 * Defines the behavior to be taken when an argument is encountered by the parser.
 * This is the TypeScript equivalent of `clap::ArgAction`.
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
 * Configuration for a command-line argument (a flag, option, or positional).
 * This is the primary interface for defining arguments and is used with the `@Arg` decorator.
 * It is the TypeScript equivalent of `clap::Arg`.
 */
export interface Arg {
  /**
   * The unique identifier for this argument.
   * Corresponds to the property name on the class. This is set automatically by the decorator.
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
   * Short description shown in help text.
   */
  help?: string;

  /**
   * Longer description shown in the detailed help text (`--help`).
   */
  longHelp?: string;

  /**
   * The name of an environment variable to check if the argument is not present.
   */
  env?: string;

  /**
   * Whether this argument must be provided by the user.
   */
  required?: boolean;

  /**
   * The default value to use if the argument is not provided.
   */
  default?: unknown;

  /**
   * The expected type of the argument's value.
   * This is used for basic parsing if no `valueParser` is provided.
   * In the decorator-based API, this is often inferred from the property's type.
   */
  type?: "string" | "number" | "boolean" | "list";

  /**
   * The action to take when the argument is encountered.
   * Defaults are inferred from the property type (e.g. a `boolean` property defaults to `SetTrue`).
   */
  action?: ArgAction;

  /**
   * A custom function or a string identifier for a built-in parser to validate and/or transform the value.
   */
  valueParser?: ValueParser | "number" | "file";

  /**
   * A list of allowed values for this argument. The parser will reject any input that is not in this list.
   */
  possibleValues?: string[];

  /**
   * If `true`, this argument is inherited by all subcommands.
   */
  global?: boolean;

  /**
   * The explicit index for a positional argument. Positional arguments are ordered by their index.
   * If this property is omitted and the argument has no `short` or `long` name, it is considered a positional argument
   * and its order is determined by its declaration order in the class.
   */
  index?: number;
}
