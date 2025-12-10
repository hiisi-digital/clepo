// loru/packages/clepo/parser.ts

import { type Arg, ArgAction } from "./arg.ts";
import type { Command } from "./command.ts";
import type { CommandInstance } from "./command.ts";
import { ClepoError, ErrorKind } from "./error.ts";
import { type ArgCursor, type ParsedArg, RawArgs } from "./lexer.ts";

/**
 * The result of a successful parse operation.
 */
export interface ParseResult {
  /** The instance of the matched command class, populated with parsed values. */
  instance: CommandInstance;
  /** The command definition object for the matched command. */
  command: Command;
  /** `true` if the user requested help (e.g., via `--help`). */
  helpRequested?: boolean;
  /** `true` if the user requested the version (e.g., via `--version`). */
  versionRequested?: boolean;
}

/**
 * The result of processing a flag.
 * @internal
 */
interface FlagResult {
  help?: boolean;
  version?: boolean;
}

/**
 * The core parser for clepo.
 * It resolves the command, tokenizes arguments using the lexer,
 * and populates the command instance.
 */
export class Parser {
  constructor(private root: Command) {}

  /**
   * Main entry point for parsing command-line arguments.
   */
  public parse(args: string[], env: Record<string, string> = {}): ParseResult {
    const { command: activeCommand, consumedIndices } = this.resolveCommand(
      args,
    );

    if (!activeCommand.cls) {
      throw new ClepoError(
        ErrorKind.Internal,
        `Command "${activeCommand.name}" has no associated class constructor. This is an internal library error.`,
        activeCommand,
      );
    }
    const instance = new activeCommand.cls();

    const remainingArgs = args.filter((_, i) => !consumedIndices.has(i));
    const rawArgs = new RawArgs(remainingArgs);

    const { helpRequested, versionRequested } = this.parseTokens(
      instance,
      activeCommand,
      rawArgs,
    );

    if (helpRequested || versionRequested) {
      return {
        instance,
        command: activeCommand,
        helpRequested,
        versionRequested,
      };
    }

    this.applyDefaultsAndEnv(instance, activeCommand, env);
    this.validateRequired(instance, activeCommand);

    return { instance, command: activeCommand };
  }

  /**
   * Walks through the arguments to identify the final subcommand to be executed.
   */
  private resolveCommand(
    args: string[],
  ): { command: Command; consumedIndices: Set<number> } {
    let currentCommand = this.root;
    const consumedIndices = new Set<number>();

    for (let i = 0; i < args.length; i++) {
      const token = args[i];
      if (token.startsWith("-") || token === "--") {
        break;
      }

      const subcommand = currentCommand.subcommands.get(token);
      if (subcommand) {
        currentCommand = subcommand;
        consumedIndices.add(i);
      } else {
        break; // Not a subcommand, must be a positional
      }
    }
    return { command: currentCommand, consumedIndices };
  }

  /**
   * Iterates through all arguments from `RawArgs` and populates the command instance.
   */
  private parseTokens(
    instance: CommandInstance,
    command: Command,
    rawArgs: RawArgs,
  ) {
    const cursor = rawArgs.cursor();
    let helpRequested = false;
    let versionRequested = false;
    let endOfFlags = false;

    const positionals = [...command.args.values()]
      .filter((a) => !a.short && !a.long)
      .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));
    let positionalIndex = 0;

    while (true) {
      const arg = rawArgs.next(cursor);
      if (!arg) break;

      if (endOfFlags) {
        this.processPositional(
          instance,
          command,
          arg,
          positionals,
          positionalIndex++,
        );
        continue;
      }

      if (arg.isEscape()) {
        endOfFlags = true;
        continue;
      }

      if (arg.isLong()) {
        const result = this.processLongFlag(
          instance,
          command,
          arg,
          rawArgs,
          cursor,
        );
        if (result.help) helpRequested = true;
        if (result.version) versionRequested = true;
        continue;
      }

      if (arg.isShort()) {
        const result = this.processShortFlag(
          instance,
          command,
          arg,
          rawArgs,
          cursor,
        );
        if (result.help) helpRequested = true;
        if (result.version) versionRequested = true;
        continue;
      }

      // If we reach here, it's a positional argument.
      const currentPositional = positionals[positionalIndex];
      this.processPositional(
        instance,
        command,
        arg,
        positionals,
        positionalIndex,
      );
      if (
        currentPositional &&
        this.resolveAction(currentPositional) !== ArgAction.Append
      ) {
        positionalIndex++;
      }
    }

    return { helpRequested, versionRequested };
  }

  private processPositional(
    instance: CommandInstance,
    command: Command,
    arg: ParsedArg,
    positionals: Arg[],
    index: number,
  ) {
    if (index >= positionals.length) {
      throw new ClepoError(
        ErrorKind.UnexpectedArgument,
        `Found argument '${arg.toValue()}' which wasn't expected, or isn't valid in this context.`,
        command,
      );
    }
    const argDef = positionals[index];
    const value = this.validateAndParseValue(arg.toValue(), argDef, command);
    this.applyValue(instance, argDef, this.resolveAction(argDef), value);
  }

  private processLongFlag(
    instance: CommandInstance,
    command: Command,
    arg: ParsedArg,
    rawArgs: RawArgs,
    cursor: ArgCursor,
  ): FlagResult {
    const [flagName, attachedValue] = arg.toLong()!;

    if (flagName === "help") return { help: true };
    if (flagName === "version") return { version: true };

    const argDef = this.findArgDef(flagName, command);
    if (!argDef) {
      throw new ClepoError(
        ErrorKind.UnknownArgument,
        `Found argument '--${flagName}' which wasn't expected.`,
        command,
      );
    }

    const action = this.resolveAction(argDef);
    let value: string | undefined = attachedValue;

    if (this.actionTakesValue(action) && value === undefined) {
      const nextArg = rawArgs.peek(cursor);
      if (nextArg && !nextArg.isLong() && !nextArg.isShort()) {
        value = rawArgs.nextRaw(cursor);
      } else {
        throw new ClepoError(
          ErrorKind.MissingValue,
          `The argument '--${flagName}' requires a value, but none was supplied.`,
          command,
        );
      }
    }

    const parsedValue = this.validateAndParseValue(value, argDef, command);
    this.applyValue(instance, argDef, action, parsedValue);
    return {};
  }

  private processShortFlag(
    instance: CommandInstance,
    command: Command,
    arg: ParsedArg,
    rawArgs: RawArgs,
    cursor: ArgCursor,
  ): FlagResult {
    const shorts = arg.toShort()!;
    let helpRequested = false;
    let versionRequested = false;

    while (true) {
      const flagChar = shorts.nextFlag();
      if (!flagChar) break;

      if (flagChar === "h") {
        helpRequested = true;
        continue;
      }
      if (flagChar === "V") {
        versionRequested = true;
        continue;
      }

      const argDef = this.findArgDef(flagChar, command);
      if (!argDef) {
        throw new ClepoError(
          ErrorKind.UnknownArgument,
          `Found argument '-${flagChar}' which wasn't expected.`,
          command,
        );
      }

      const action = this.resolveAction(argDef);
      let value: string | undefined;

      if (this.actionTakesValue(action)) {
        value = shorts.nextValue(); // e.g., -j4
        if (value === undefined) {
          const nextArg = rawArgs.peek(cursor);
          if (nextArg && !nextArg.isLong() && !nextArg.isShort()) {
            value = rawArgs.nextRaw(cursor); // e.g., -j 4
          } else {
            throw new ClepoError(
              ErrorKind.MissingValue,
              `The argument '-${flagChar}' requires a value, but none was supplied.`,
              command,
            );
          }
        }
      }
      const parsedValue = this.validateAndParseValue(value, argDef, command);
      this.applyValue(instance, argDef, action, parsedValue);

      if (value !== undefined) {
        break; // A value-taking flag consumes the rest of the cluster.
      }
    }
    return { help: helpRequested, version: versionRequested };
  }

  /**
   * Finds an argument definition within the current command.
   * NOTE: This relies on the `finalize()` method having been called to propagate
   * global arguments down to the command's `args` map, making parent lookups unnecessary.
   */
  private findArgDef(flagName: string, command: Command): Arg | undefined {
    for (const arg of command.args.values()) {
      if (arg.short === flagName || arg.long === flagName) {
        return arg;
      }
    }
    return undefined;
  }

  /**
   * Applies default and environment variable values for any arguments not already set.
   */
  private applyDefaultsAndEnv(
    instance: CommandInstance,
    command: Command,
    env: Record<string, string>,
  ) {
    for (const arg of command.args.values()) {
      const key = arg.id!;
      if ((instance as unknown as Record<string, unknown>)[key] !== undefined) {
        continue;
      }

      let valueSource: string | undefined;
      if (arg.env && env[arg.env]) {
        valueSource = env[arg.env];
      }

      if (valueSource !== undefined) {
        const value = this.validateAndParseValue(valueSource, arg, command);
        this.applyValue(instance, arg, this.resolveAction(arg), value);
      } else if (arg.default !== undefined) {
        (instance as unknown as Record<string, unknown>)[key] = arg.default;
      }
    }
  }

  /**
   * Checks that all required arguments have a value.
   */
  private validateRequired(instance: CommandInstance, command: Command) {
    for (const arg of command.args.values()) {
      if (
        arg.required &&
        (instance as unknown as Record<string, unknown>)[arg.id!] === undefined
      ) {
        const name = arg.long
          ? `--${arg.long}`
          : (arg.short ? `-${arg.short}` : arg.id!);
        throw new ClepoError(
          ErrorKind.MissingRequiredArgument,
          `The following required argument was not provided: ${name}`,
          command,
        );
      }
    }
  }

  /**
   * Takes a raw string value and validates/parses it according to the Arg definition.
   */
  private validateAndParseValue(
    value: string | undefined | null,
    argDef: Arg,
    command: Command,
  ): unknown {
    if (!this.actionTakesValue(this.resolveAction(argDef))) {
      return undefined;
    }
    if (value === undefined || value === null) {
      return undefined;
    }

    const argName = argDef.long ?? argDef.short ?? argDef.id!;

    let parsedValue: unknown = value;
    if (typeof argDef.valueParser === "function") {
      try {
        parsedValue = argDef.valueParser(value);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new ClepoError(
          ErrorKind.InvalidArgumentValue,
          `Invalid value for '${argName}': ${message}`,
          command,
        );
      }
    } else if (argDef.valueParser === "number" || argDef.type === "number") {
      parsedValue = Number(value);
      if (isNaN(parsedValue as number)) {
        throw new ClepoError(
          ErrorKind.InvalidArgumentValue,
          `Invalid value for '${argName}': expected a number, got '${value}'.`,
          command,
        );
      }
    } else if (argDef.valueParser === "file") {
      try {
        Deno.statSync(value);
      } catch (e) {
        if (e instanceof Deno.errors.NotFound) {
          throw new ClepoError(
            ErrorKind.InvalidArgumentValue,
            `Invalid value for '${argName}': file not found at path '${value}'`,
            command,
          );
        }
        const message = e instanceof Error ? e.message : String(e);
        throw new ClepoError(
          ErrorKind.InvalidArgumentValue,
          `Invalid value for '${argName}': could not access file at '${value}' (${message})`,
          command,
        );
      }
    } else if (argDef.type === "boolean") {
      parsedValue = value.toLowerCase() === "true" || value === "1";
    }

    if (
      argDef.possibleValues &&
      !argDef.possibleValues.includes(String(parsedValue))
    ) {
      throw new ClepoError(
        ErrorKind.InvalidArgumentValue,
        `'${parsedValue}' is not a valid value for '${argName}'.\n    [possible values: ${
          argDef.possibleValues.join(", ")
        }]`,
        command,
      );
    }

    return parsedValue;
  }

  /**
   * Determines the action to perform for an argument, inferring from type if not explicit.
   */
  private resolveAction(arg: Arg): ArgAction {
    if (arg.action) return arg.action;
    if (arg.type === "boolean") return ArgAction.SetTrue;
    if (arg.type === "list") return ArgAction.Append;
    return ArgAction.Set;
  }

  /**
   * Checks if an action requires a value from the argument list.
   */
  private actionTakesValue(action: ArgAction): boolean {
    return action === ArgAction.Set || action === ArgAction.Append;
  }

  /**
   * Updates the command instance with a parsed value based on the specified action.
   */
  private applyValue(
    instance: CommandInstance,
    arg: Arg,
    action: ArgAction,
    value: unknown,
  ) {
    const target = instance as unknown as Record<string, unknown>;
    const key = arg.id!;
    switch (action) {
      case ArgAction.Set:
        target[key] = value;
        break;
      case ArgAction.Append:
        if (!Array.isArray(target[key])) {
          target[key] = [];
        }
        (target[key] as unknown[]).push(value);
        break;
      case ArgAction.SetTrue:
        target[key] = true;
        break;
      case ArgAction.SetFalse:
        target[key] = false;
        break;
      case ArgAction.Count:
        target[key] = ((target[key] as number) || 0) + 1;
        break;
    }
  }
}
