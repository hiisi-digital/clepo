// loru/packages/clepo/arg.ts

import { reflect, type ReflectType } from "./reflect.ts";

/**
 * The action to perform when an argument is found.
 * This is the TypeScript equivalent of `clap::ArgAction`.
 */
export enum ArgAction {
  /** Stores the value. */
  Set,
  /** Appends the value to a list. */
  Append,
  /** Stores `true`. */
  SetTrue,
  /** Stores `false`. */
  SetFalse,
  /** Increments a counter. */
  Count,
  /** Triggers the help message. */
  Help,
  /** Triggers the version message. */
  Version,
}

/**
 * Built-in value parser identifiers.
 * These can be passed to `valueParser` instead of a custom function.
 */
export type BuiltinValueParser =
  | "number"
  | "file"
  | "boolish"
  | { ranged: [number, number] };

/**
 * Parses a string as a "boolish" value.
 * Accepts: true/false, yes/no, on/off, 1/0 (case-insensitive).
 * @param value The string to parse.
 * @returns The parsed boolean value.
 * @throws Error if the value is not a recognized boolish string.
 */
export function parseBoolish(value: string): boolean {
  const lower = value.toLowerCase().trim();
  const truthy = ["true", "yes", "on", "1"];
  const falsy = ["false", "no", "off", "0"];

  if (truthy.includes(lower)) return true;
  if (falsy.includes(lower)) return false;

  throw new Error(
    `expected one of: true/false, yes/no, on/off, 1/0, got '${value}'`,
  );
}

/**
 * Creates a ranged integer parser.
 * @param min The minimum allowed value (inclusive).
 * @param max The maximum allowed value (inclusive).
 * @returns A function that parses and validates the value.
 */
export function createRangedParser(
  min: number,
  max: number,
): (value: string) => number {
  return (value: string): number => {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`expected a number, got '${value}'`);
    }
    if (!Number.isInteger(num)) {
      throw new Error(`expected an integer, got '${value}'`);
    }
    if (num < min || num > max) {
      throw new Error(`value ${num} is out of range [${min}, ${max}]`);
    }
    return num;
  };
}

/**
 * Configuration for a command-line argument.
 * This is a hybrid of `clap::Arg` and the `clap_derive::Arg` attribute.
 */
export class Arg {
  /** A unique identifier for the argument, typically the class property name. */
  public id?: string;
  /** The short flag, e.g., 'c' for `-c`. */
  public short?: string;
  /** The long flag, e.g., 'config' for `--config`. */
  public long?: string;
  /** The help text for the argument. */
  public help?: string;
  /** The action to perform when the argument is found. */
  public action?: ArgAction;
  /** Whether the argument is required. */
  public required?: boolean;
  /** The default value for the argument. */
  // deno-lint-ignore no-explicit-any
  public default?: any;
  /** The environment variable to read from if the argument is not present. */
  public env?: string;
  /** The name of the value, used in the help message (e.g., `<FILE>`). */
  public valueName?: string;
  /** A list of possible values for the argument. */
  public possibleValues?: string[];
  /**
   * A function to parse and validate the value, or a built-in parser identifier.
   *
   * Built-in parsers:
   * - `"number"` - Parses as a number, rejects NaN.
   * - `"file"` - Placeholder for file path validation (not yet fully implemented).
   * - `"boolish"` - Accepts yes/no, on/off, true/false, 1/0.
   * - `{ ranged: [min, max] }` - Parses as integer within the given range (inclusive).
   */
  public valueParser?:
    | ((value: string) => unknown)
    | BuiltinValueParser;
  /** The property type, inferred via reflection. */
  public type?: "string" | "number" | "boolean" | "list";
  /** The zero-based index for a positional argument. */
  public index?: number;
  /** If `true`, this argument is passed down to subcommands. */
  public global?: boolean;
  /** The group this argument belongs to. */
  public group?: string;
  /** Arguments that conflict with this argument. */
  public conflictsWith?: string[];
  /** If `true`, this argument is hidden from help output. Useful for internal args. */
  public hide?: boolean;

  constructor(config: Partial<Arg> = {}) {
    Object.assign(this, config);
  }

  /**
   * Initializes the argument from decorator metadata and reflection.
   * This is called by the `@Arg` decorator.
   */
  public init(
    target: object,
    propertyKey: string,
  ): void {
    this.id = propertyKey;

    const reflectedType = reflect.getType(target, propertyKey);
    this.inferFromType(reflectedType);
  }

  /**
   * Infers argument properties (`action`, `type`, `valueName`) from the
   * reflected TypeScript type of the class property.
   *
   * Note: Explicit configuration always takes precedence over reflection.
   * This is important for:
   * 1. Future TC39 decorators (which don't support emitDecoratorMetadata)
   * 2. Cases where reflection is unavailable or incorrect
   * 3. User preference to override inferred types
   */
  private inferFromType(type: ReflectType | undefined): void {
    // If type was explicitly set in config, don't override it
    const explicitType = this.type;

    if (!type && !explicitType) {
      return;
    }

    // Infer from reflection if no explicit type was provided
    if (!explicitType && type) {
      switch (type.name) {
        case "String":
          this.type = "string";
          break;
        case "Number":
          this.type = "number";
          break;
        case "Boolean":
          this.type = "boolean";
          break;
        case "Array":
          this.type = "list";
          break;
      }
    }

    // Set valueName based on type (explicit or inferred)
    if (!this.valueName) {
      if (type) {
        this.valueName = type.name.toUpperCase();
      } else if (this.type) {
        this.valueName = this.type.toUpperCase();
      }
    }

    // Set default action based on type (explicit or inferred)
    if (this.action === undefined) {
      switch (this.type) {
        case "string":
        case "number":
          this.action = ArgAction.Set;
          break;
        case "boolean":
          // The default action for a boolean is `SetTrue`, which doesn't take a value.
          // This allows `--verbose` instead of `--verbose=true`.
          // If the user wants `Set`, they must be explicit.
          this.action = ArgAction.SetTrue;
          break;
        case "list":
          this.action = ArgAction.Append;
          break;
      }
    }
  }

  /**
   * Checks if the argument is positional (i.e., has no short or long flag).
   */
  public isPositional(): boolean {
    return !this.short && !this.long;
  }

  /**
   * Determines if the argument's action requires a value.
   * e.g., `Set` and `Append` require a value, but `SetTrue` and `Count` do not.
   */
  public takesValue(): boolean {
    const action = this.action ??
      (this.type === "boolean" ? ArgAction.SetTrue : ArgAction.Set);
    return action === ArgAction.Set || action === ArgAction.Append;
  }
}
