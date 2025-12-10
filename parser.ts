import {
  type Arg,
  ArgAction,
  type CommandInstance,
  type CommandMetadata,
} from "./types.ts";

export class ParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParserError";
  }
}

interface ParseResult {
  instance: CommandInstance;
  meta: CommandMetadata;
  helpRequested?: boolean;
  versionRequested?: boolean;
}

/**
 * The core parser for clepo.
 * It resolves the command, parses arguments, and populates the command instance.
 */
export class Parser {
  constructor(private root: CommandMetadata) {}

  /**
   * Main entry point for parsing command-line arguments.
   */
  public parse(args: string[], env: Record<string, string> = {}): ParseResult {
    // 1. Find the active command and which arguments were consumed for it.
    const { meta: activeMeta, consumedIndices } = this.resolveCommand(args);

    // 2. Instantiate the command class.
    const instance = new activeMeta.cls();

    // 3. Parse all tokens (flags and positionals).
    const { helpRequested, versionRequested } = this.parseTokens(
      instance,
      activeMeta,
      args,
      consumedIndices,
    );

    if (helpRequested || versionRequested) {
      return { instance, meta: activeMeta, helpRequested, versionRequested };
    }

    // 4. Apply values from environment variables or defaults if they weren't set.
    this.applyDefaultsAndEnv(instance, activeMeta, env);

    // 5. Check if all required arguments have been provided.
    this.validateRequired(instance, activeMeta);

    return { instance, meta: activeMeta };
  }

  /**
   * Walks through the arguments to identify the final subcommand to be executed.
   * @returns The metadata for the active command and a set of argument indices that were consumed (i.e., the subcommand names).
   */
  private resolveCommand(
    args: string[],
  ): { meta: CommandMetadata; consumedIndices: Set<number> } {
    let currentMeta = this.root;
    const consumedIndices = new Set<number>();

    for (let i = 0; i < args.length; i++) {
      const token = args[i];
      // Stop resolving subcommands if we hit a flag.
      if (token.startsWith("-")) {
        break;
      }
      if (currentMeta.subcommands.has(token)) {
        currentMeta = currentMeta.subcommands.get(token)!;
        consumedIndices.add(i);
      } else {
        // This is a positional argument, not a subcommand.
        break;
      }
    }
    return { meta: currentMeta, consumedIndices };
  }

  /**
   * Iterates through all tokens and populates the command instance.
   */
  private parseTokens(
    instance: CommandInstance,
    meta: CommandMetadata,
    args: string[],
    consumed: Set<number>,
  ) {
    let helpRequested = false;
    let versionRequested = false;

    const positionals = [...meta.args.values()]
      .filter((a) => !a.short && !a.long)
      .sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));
    let positionalIndex = 0;

    for (let cursor = 0; cursor < args.length; cursor++) {
      if (consumed.has(cursor)) {
        continue;
      }

      const token = args[cursor];

      if (token.startsWith("-")) {
        // Handle Flags
        const result = this.parseFlag(
          instance,
          meta,
          token,
          args[cursor + 1],
        );
        if (result.valueConsumed) cursor++;
        if (result.help) helpRequested = true;
        if (result.version) versionRequested = true;
      } else {
        // Handle Positionals
        if (positionalIndex >= positionals.length) {
          throw new ParserError(`Unexpected argument: ${token}`);
        }
        const argDef = positionals[positionalIndex];
        const value = this.validateAndParseValue(token, argDef);
        const action = this.resolveAction(argDef);
        this.applyValue(
          instance as unknown as Record<string, unknown>,
          argDef,
          action,
          value,
        );

        // Only advance to the next positional if the action is not 'Append'.
        // If it is 'Append', it will consume all subsequent positional args.
        if (action !== ArgAction.Append) {
          positionalIndex++;
        }
      }
    }
    return { helpRequested, versionRequested };
  }

  /**
   * Parses a single flag token (e.g., `-f` or `--force`).
   */
  private parseFlag(
    instance: CommandInstance,
    meta: CommandMetadata,
    token: string,
    nextToken?: string,
  ) {
    let flagName = token.replace(/^-+/, "");
    let explicitValue: string | undefined;

    if (flagName.includes("=")) {
      [flagName, explicitValue] = flagName.split("=", 2);
    }

    // Handle special built-in flags first
    if (flagName === "h" || flagName === "help") return { help: true };
    if (flagName === "V" || flagName === "version") return { version: true };

    const argDef = this.findArgDef(flagName, meta);
    if (!argDef) {
      throw new ParserError(`Unknown argument: ${token}`);
    }

    const action = this.resolveAction(argDef);
    let value: string | undefined;
    let valueConsumed = false;

    if (this.actionTakesValue(action)) {
      if (explicitValue !== undefined) {
        value = explicitValue;
      } else if (nextToken && !nextToken.startsWith("-")) {
        value = nextToken;
        valueConsumed = true;
      } else {
        throw new ParserError(`Flag '${token}' requires a value.`);
      }
    }

    const parsedValue = this.validateAndParseValue(value, argDef);
    this.applyValue(
      instance as unknown as Record<string, unknown>,
      argDef,
      action,
      parsedValue,
    );

    return { valueConsumed };
  }

  /**
   * Finds an argument definition within the current command or its parents (for globals).
   */
  private findArgDef(flagName: string, meta: CommandMetadata): Arg | undefined {
    let current: CommandMetadata | undefined = meta;
    while (current) {
      for (const arg of current.args.values()) {
        const isMatch = arg.short === flagName || arg.long === flagName;
        if (isMatch) {
          // If it's not on the immediate command, it must be global to be valid.
          if (current === meta || arg.global) {
            return arg;
          }
        }
      }
      current = current.parent;
    }
    return undefined;
  }

  /**
   * Applies default and environment variable values for any arguments not already set.
   */
  private applyDefaultsAndEnv(
    instance: CommandInstance,
    meta: CommandMetadata,
    env: Record<string, string>,
  ) {
    for (const arg of meta.args.values()) {
      const key = arg.id!;
      if ((instance as unknown as Record<string, unknown>)[key] !== undefined) {
        continue; // Value was already set by parser
      }

      let value: unknown;
      if (arg.env && env[arg.env]) {
        value = this.validateAndParseValue(env[arg.env], arg);
      } else if (arg.default !== undefined) {
        value = arg.default;
      }

      if (value !== undefined) {
        this.applyValue(
          instance as unknown as Record<string, unknown>,
          arg,
          this.resolveAction(arg),
          value,
        );
      }
    }
  }

  /**
   * Checks that all required arguments have a value.
   */
  private validateRequired(instance: CommandInstance, meta: CommandMetadata) {
    for (const arg of meta.args.values()) {
      if (
        arg.required &&
        (instance as unknown as Record<string, unknown>)[arg.id!] === undefined
      ) {
        throw new ParserError(`Missing required argument: ${arg.id}`);
      }
    }
  }

  /**
   * Takes a raw string value and validates/parses it according to the Arg definition.
   */
  private validateAndParseValue(
    value: string | undefined,
    argDef: Arg,
  ): unknown {
    // For actions like SetTrue or Count, the value is irrelevant.
    if (!this.actionTakesValue(this.resolveAction(argDef))) {
      return undefined;
    }
    if (value === undefined) {
      // This can happen for optional flags that weren't provided.
      return undefined;
    }

    let parsedValue: unknown = value;
    if (argDef.valueParser) {
      parsedValue = argDef.valueParser(value);
    } else if (argDef.type === "number") {
      parsedValue = Number(value);
      if (isNaN(parsedValue as number)) {
        throw new ParserError(
          `Invalid value for '${argDef.id}': expected a number.`,
        );
      }
    } else if (argDef.type === "boolean") {
      parsedValue = value.toLowerCase() === "true" || value === "1";
    }

    if (
      argDef.possibleValues &&
      !argDef.possibleValues.includes(String(parsedValue))
    ) {
      throw new ParserError(
        `Invalid value '${parsedValue}' for '${argDef.id}'. Possible values: ${
          argDef.possibleValues.join(", ")
        }`,
      );
    }

    return parsedValue;
  }

  /**
   * Determines the action to perform for an argument, inferring from type if not explicit.
   */
  private resolveAction(arg: Arg): ArgAction {
    if (arg.action) return arg.action;
    // Infer default actions
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
    target: Record<string, unknown>,
    arg: Arg,
    action: ArgAction,
    value: unknown,
  ) {
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
