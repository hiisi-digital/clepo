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
  /** A function to parse and validate the value. */
  // deno-lint-ignore no-explicit-any
  public valueParser?: ((value: string) => any) | "number" | "file";
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
   */
  private inferFromType(type: ReflectType | undefined): void {
    if (!type) {
      return;
    }

    this.valueName = this.valueName ?? type.name.toUpperCase();

    switch (type.name) {
      case "String":
        this.type = "string";
        this.action = this.action ?? ArgAction.Set;
        break;
      case "Number":
        this.type = "number";
        this.action = this.action ?? ArgAction.Set;
        break;
      case "Boolean":
        this.type = "boolean";
        // The default action for a boolean is `SetTrue`, which doesn't take a value.
        // This allows `--verbose` instead of `--verbose=true`.
        // If the user wants `Set`, they must be explicit.
        this.action = this.action ?? ArgAction.SetTrue;
        break;
      case "Array":
        this.type = "list";
        this.action = this.action ?? ArgAction.Append;
        break;
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
