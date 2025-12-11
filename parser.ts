// loru/packages/clepo/parser.ts

import { type Arg, ArgAction, createRangedParser, parseBoolish } from "./arg.ts";
import { ArgMatcher, type ArgMatches, ValueSource } from "./arg_matcher.ts";
import type { CommandInstance } from "./command.ts";
import { type Command, CommandSettings } from "./command.ts";
import { ClepoError, ErrorKind } from "./error.ts";
import { type ArgCursor, type ParsedArg, RawArgs } from "./lexer.ts";
import { findClosestMatch } from "./util.ts";

/**
 * The result of a successful parse operation.
 */
export interface ParseResult {
  /** The root instance of the matched command chain, populated with parsed values. */
  instance: CommandInstance;
  /** The command definition object for the matched (leaf) command. */
  command: Command;
  /** `true` if the user requested help (e.g., via `--help`). */
  helpRequested?: boolean;
  /** `true` if the user requested the version (e.g., via `--version`). */
  versionRequested?: boolean;
}

/**
 * The core parser for clepo.
 * It resolves the command chain, tokenizes arguments, and populates command instances.
 *
 * Unlike the previous implementation, this uses a recursive descent approach with
 * a stateful `ArgMatcher` to accurately reflect `clap`'s parsing logic.
 */
export class Parser {
  /**
   * @param root The root command of the CLI application.
   * @param debug A flag to enable verbose logging of the parsing process.
   */
  constructor(private root: Command, private debug = false) {}

  /**
   * Main entry point for parsing command-line arguments.
   */
  public parse(
    args: string[],
    env: Record<string, string> = {},
  ): ParseResult {
    // Ensure the command tree is finalized (globals propagated, etc.)
    this.root.finalize();

    const rawArgs = new RawArgs(args);
    const cursor = rawArgs.cursor();
    const rootMatcher = new ArgMatcher();

    // 1. Parse (Recursive) - Populates matcher and fills defaults
    this.parseArgs(this.root, rootMatcher, rawArgs, cursor, env);

    // 2. Seal the matches
    const rootMatches = rootMatcher.intoInner();

    // 3. Find the active leaf command (the deepest subcommand matched)
    const { command: leafCommand, matches: leafMatches } = this.findLeaf(
      this.root,
      rootMatches,
    );

    // 4. Check for Help/Version actions *before* validation
    const helpRequested = this.checkAction(
      leafCommand,
      leafMatches,
      ArgAction.Help,
    );
    const versionRequested = this.checkAction(
      leafCommand,
      leafMatches,
      ArgAction.Version,
    );

    if (helpRequested || versionRequested) {
      // Return early without validation or full hydration.
      // We return a dummy instance because the user code shouldn't run anyway.
      return {
        instance: this.root.cls ? new this.root.cls() : {} as CommandInstance,
        command: leafCommand,
        helpRequested,
        versionRequested,
      };
    }

    // 5. Validate (Recursive)
    this.validate(this.root, rootMatches);

    // 6. Hydrate (Recursive)
    const instance = this.hydrate(this.root, rootMatches);

    return {
      instance,
      command: leafCommand,
    };
  }

  /**
   * Recursively parses arguments for a given command.
   * If a subcommand is encountered, it recurses.
   */
  private parseArgs(
    command: Command,
    matcher: ArgMatcher,
    rawArgs: RawArgs,
    cursor: ArgCursor,
    env: Record<string, string>,
  ): void {
    const positionals = [...command.args.values()]
      .filter((a) => a.isPositional())
      .sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
    let posIndex = 0;
    let trailingValues = false;

    while (true) {
      const peek = rawArgs.peek(cursor);
      if (!peek) break;

      // 1. Check for Subcommand (if not in trailing values mode)
      // We only check for subcommands if we haven't seen `--`.
      if (!trailingValues) {
        const val = peek.toValue();
        // Standard clap behavior: subcommands are bare words.
        // Flags (starting with -) are not subcommands unless configured otherwise.
        if (!peek.isLong() && !peek.isShort() && !peek.isStdio()) {
          const sub = command.subcommands.get(val);
          if (sub) {
            this.debugLog(`Found subcommand: ${sub.name}`);
            rawArgs.next(cursor); // Consume the subcommand token

            const subMatcher = new ArgMatcher();
            // Recurse!
            this.parseArgs(sub, subMatcher, rawArgs, cursor, env);

            // Attach result to current matcher and STOP parsing for this command.
            matcher.setSubcommand(sub.name, subMatcher.intoInner());

            // We return here because control has passed to the subcommand.
            // But we must fill defaults for THIS command before returning.
            this.fillDefaultsAndEnv(command, matcher, env);
            return;
          }
        }
      }

      const arg = rawArgs.next(cursor)!;
      this.debugLog(`Processing token: ${arg.raw}`);

      // 2. Handle escape `--`
      if (arg.isEscape()) {
        if (trailingValues) {
          // If we are already in trailing values, `--` is just a value
        } else {
          this.debugLog(`  -> End of flags detected ('--')`);
          trailingValues = true;
          continue;
        }
      }

      // 3. Handle Long Flag
      if (arg.isLong() && !trailingValues) {
        this.parseLong(command, matcher, arg, rawArgs, cursor);
        continue;
      }

      // 4. Handle Short Flag(s)
      if (arg.isShort() && !trailingValues && !arg.isNegativeNumber()) {
        this.parseShort(command, matcher, arg, rawArgs, cursor);
        continue;
      }

      // 5. Positional
      this.debugLog(`  -> Processing as positional`);

      if (posIndex >= positionals.length) {
        const value = arg.toValue();
        // Check if it might be a misspelled subcommand
        const subcommandNames = [...new Set(command.subcommands.values())].map((s) => s.name);
        const suggestion = findClosestMatch(value, subcommandNames);
        const suggestionText = suggestion
          ? `\n\n    tip: a similar subcommand exists: '${suggestion}'`
          : "";
        throw new ClepoError(
          ErrorKind.UnexpectedArgument,
          `Found argument '${value}' which wasn't expected, or isn't valid in this context.${suggestionText}`,
          command,
        );
      }

      const argDef = positionals[posIndex];
      const value = this.parseValue(arg.toValue(), argDef, command);

      matcher.startCustomArg(argDef, ValueSource.CommandLine);
      matcher.addValTo(argDef.id!, value);
      matcher.addIndexTo(argDef.id!, cursor.index - 1);
      matcher.incOccurrenceOf(argDef.id!);

      // If the argument does not take multiple values, move to the next positional slot.
      if (!this.argTakesMultiple(argDef)) {
        posIndex++;
      }
    }

    // End of args for this command level
    this.fillDefaultsAndEnv(command, matcher, env);
  }

  private parseLong(
    cmd: Command,
    matcher: ArgMatcher,
    arg: ParsedArg,
    raw: RawArgs,
    cursor: ArgCursor,
  ): void {
    const [key, attachedVal] = arg.toLong()!;
    const argDef = this.findArg(cmd, key, "long");

    if (!argDef) {
      // Collect all long flags for suggestion
      const longFlags = [...cmd.args.values()]
        .filter((a) => a.long)
        .map((a) => a.long!);
      const suggestion = findClosestMatch(key, longFlags);
      const suggestionText = suggestion
        ? `\n\n    tip: a similar argument exists: '--${suggestion}'`
        : "";
      throw new ClepoError(
        ErrorKind.UnknownArgument,
        `Found argument '--${key}' which wasn't expected.${suggestionText}`,
        cmd,
      );
    }

    matcher.startCustomArg(argDef, ValueSource.CommandLine);
    matcher.incOccurrenceOf(argDef.id!);
    matcher.addIndexTo(argDef.id!, cursor.index - 1);

    if (argDef.takesValue()) {
      let valStr = attachedVal;
      if (valStr === undefined) {
        // Try to consume the next token as value
        const peek = raw.peek(cursor);
        // We only consume if the next token doesn't look like a flag (unless allowHyphenValues is on)
        if (peek && !peek.isLong() && !peek.isShort() && !peek.isEscape()) {
          valStr = raw.nextRaw(cursor);
          this.debugLog(`    -> Consumed next token as value: ${valStr}`);
        } else {
          const valueName = argDef.valueName ?? argDef.id ?? "VALUE";
          throw new ClepoError(
            ErrorKind.MissingValue,
            `The argument '--${key}' requires a value, but none was supplied.\n` +
              `    usage: --${key} <${valueName}>`,
            cmd,
          );
        }
      } else {
        this.debugLog(`    -> Found attached value: ${valStr}`);
      }

      const parsed = this.parseValue(valStr, argDef, cmd);
      matcher.addValTo(argDef.id!, parsed);
    } else if (attachedVal !== undefined) {
      throw new ClepoError(
        ErrorKind.UnexpectedArgument,
        `The argument '--${key}' does not take a value, but '${attachedVal}' was attached.`,
        cmd,
      );
    } else {
      // Flag with no value (e.g. SetTrue, Count)
      this.applyFlagAction(argDef, matcher);
    }
  }

  private parseShort(
    cmd: Command,
    matcher: ArgMatcher,
    arg: ParsedArg,
    raw: RawArgs,
    cursor: ArgCursor,
  ): void {
    const shorts = arg.toShort()!;
    this.debugLog(`  -> Short flag(s): -${shorts.raw}`);

    while (true) {
      const char = shorts.nextFlag();
      if (!char) break;

      const argDef = this.findArg(cmd, char, "short");
      if (!argDef) {
        // Collect all short flags for suggestion
        const shortFlags = [...cmd.args.values()]
          .filter((a) => a.short)
          .map((a) => a.short!);
        const suggestion = findClosestMatch(char, shortFlags);
        const suggestionText = suggestion
          ? `\n\n    tip: a similar argument exists: '-${suggestion}'`
          : "";
        throw new ClepoError(
          ErrorKind.UnknownArgument,
          `Found argument '-${char}' which wasn't expected.${suggestionText}`,
          cmd,
        );
      }

      matcher.startCustomArg(argDef, ValueSource.CommandLine);
      matcher.incOccurrenceOf(argDef.id!);
      matcher.addIndexTo(argDef.id!, cursor.index - 1);

      if (argDef.takesValue()) {
        let valStr = shorts.nextValue(); // Try to get attached value from remainder of cluster
        if (valStr) {
          this.debugLog(`    -> Found attached value in cluster: ${valStr}`);
        } else {
          // Try consume next arg
          const peek = raw.peek(cursor);
          if (peek && !peek.isLong() && !peek.isShort() && !peek.isEscape()) {
            valStr = raw.nextRaw(cursor);
            this.debugLog(`    -> Consumed next token as value: ${valStr}`);
          } else {
            const valueName = argDef.valueName ?? argDef.id ?? "VALUE";
            throw new ClepoError(
              ErrorKind.MissingValue,
              `The argument '-${char}' requires a value, but none was supplied.\n` +
                `    usage: -${char} <${valueName}>` +
                (argDef.long ? ` or --${argDef.long} <${valueName}>` : ""),
              cmd,
            );
          }
        }

        const parsed = this.parseValue(valStr, argDef, cmd);
        matcher.addValTo(argDef.id!, parsed);
        // If it took a value, it must be the last in the cluster (or consumed next arg)
        break;
      } else {
        // Flag with no value
        this.applyFlagAction(argDef, matcher);
      }
    }
  }

  private parseValue(
    value: string | undefined,
    argDef: Arg,
    cmd: Command,
  ): unknown {
    if (value === undefined) return undefined;

    let parsedValue: unknown = value;

    // Custom function parser takes highest priority
    if (typeof argDef.valueParser === "function") {
      try {
        parsedValue = argDef.valueParser(value);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new ClepoError(
          ErrorKind.InvalidArgumentValue,
          `Invalid value for '${this.getArgName(argDef)}': ${message}`,
          cmd,
        );
      }
    } // Ranged integer parser: { ranged: [min, max] }
    else if (
      typeof argDef.valueParser === "object" &&
      argDef.valueParser !== null &&
      "ranged" in argDef.valueParser
    ) {
      const [min, max] = argDef.valueParser.ranged;
      const rangedParser = createRangedParser(min, max);
      try {
        parsedValue = rangedParser(value);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new ClepoError(
          ErrorKind.InvalidArgumentValue,
          `Invalid value for '${this.getArgName(argDef)}': ${message}`,
          cmd,
        );
      }
    } // Boolish parser: accepts yes/no, on/off, true/false, 1/0
    else if (argDef.valueParser === "boolish") {
      try {
        parsedValue = parseBoolish(value);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new ClepoError(
          ErrorKind.InvalidArgumentValue,
          `Invalid value for '${this.getArgName(argDef)}': ${message}`,
          cmd,
        );
      }
    } // Number parser (built-in or inferred from type)
    else if (argDef.valueParser === "number" || argDef.type === "number") {
      parsedValue = Number(value);
      if (isNaN(parsedValue as number)) {
        throw new ClepoError(
          ErrorKind.InvalidArgumentValue,
          `Invalid value for '${this.getArgName(argDef)}': expected a number, got '${value}'.`,
          cmd,
        );
      }
    } // Boolean type (strict true/false/1/0)
    else if (argDef.type === "boolean") {
      parsedValue = value.toLowerCase() === "true" || value === "1";
    }

    // Validate against possible values if defined
    if (
      argDef.possibleValues &&
      !argDef.possibleValues.includes(String(parsedValue))
    ) {
      throw new ClepoError(
        ErrorKind.InvalidArgumentValue,
        `'${parsedValue}' is not a valid value for '${
          this.getArgName(argDef)
        }'.\n    [possible values: ${argDef.possibleValues.join(", ")}]`,
        cmd,
      );
    }

    return parsedValue;
  }

  private applyFlagAction(argDef: Arg, matcher: ArgMatcher): void {
    const action = argDef.action;
    if (action === ArgAction.SetTrue) {
      matcher.addValTo(argDef.id!, true);
    } else if (action === ArgAction.SetFalse) {
      matcher.addValTo(argDef.id!, false);
    }
    // Count is handled by incOccurrenceOf
  }

  private fillDefaultsAndEnv(
    cmd: Command,
    matcher: ArgMatcher,
    env: Record<string, string>,
  ): void {
    for (const arg of cmd.args.values()) {
      if (!matcher.contains(arg.id!)) {
        // Check Env
        if (arg.env && env[arg.env]) {
          const val = this.parseValue(env[arg.env], arg, cmd);
          matcher.startCustomArg(arg, ValueSource.EnvVariable);
          matcher.addValTo(arg.id!, val);
        } // Check Default
        else if (arg.default !== undefined) {
          matcher.startCustomArg(arg, ValueSource.DefaultValue);
          matcher.addValTo(arg.id!, arg.default);
        }
      }
    }
  }

  private validate(cmd: Command, matches: ArgMatches): void {
    // 1. Required Arguments
    for (const arg of cmd.args.values()) {
      if (arg.required && !matches.contains(arg.id!)) {
        const argName = this.getArgName(arg);
        const helpHint = arg.help ? `\n    help: ${arg.help}` : "";
        throw new ClepoError(
          ErrorKind.MissingRequiredArgument,
          `The following required argument was not provided: ${argName}${helpHint}`,
          cmd,
        );
      }
    }

    // 2. Argument Groups
    for (const group of cmd.groups.values()) {
      const presentArgs = (group.args ?? []).filter((id) => matches.contains(id));

      if (group.required && presentArgs.length === 0) {
        throw new ClepoError(
          ErrorKind.MissingRequiredArgument,
          `The following required group was not satisfied: ${group.id}`,
          cmd,
        );
      }

      if (!group.multiple && presentArgs.length > 1) {
        const arg1 = cmd.args.get(presentArgs[0]);
        const arg2 = cmd.args.get(presentArgs[1]);
        const arg1Name = arg1 ? this.getArgName(arg1) : presentArgs[0];
        const arg2Name = arg2 ? this.getArgName(arg2) : presentArgs[1];
        throw new ClepoError(
          ErrorKind.ArgumentConflict,
          `The argument '${arg1Name}' cannot be used with '${arg2Name}'.\n` +
            `    note: These arguments belong to the mutually exclusive group '${group.id}'.`,
          cmd,
        );
      }
    }

    // 3. Conflicts
    for (const id of matches.ids()) {
      const arg = cmd.args.get(id);
      if (!arg || !arg.conflictsWith) continue;

      for (const conflictId of arg.conflictsWith) {
        if (matches.contains(conflictId)) {
          const conflictArg = cmd.args.get(conflictId);
          const argName = this.getArgName(arg);
          const conflictName = conflictArg ? this.getArgName(conflictArg) : conflictId;
          throw new ClepoError(
            ErrorKind.ArgumentConflict,
            `The argument '${argName}' cannot be used with '${conflictName}'.\n` +
              `    note: These arguments are mutually exclusive.`,
            cmd,
          );
        }
      }
    }

    // Check subcommand requirement
    const sub = matches.subcommandMatches();
    if (cmd.isSet(CommandSettings.SubcommandRequired) && !sub) {
      const availableSubcommands = [...new Set(cmd.subcommands.values())]
        .map((s) => s.name)
        .join(", ");
      throw new ClepoError(
        ErrorKind.MissingSubcommand,
        `'${cmd.name}' requires a subcommand but one was not provided.\n` +
          `    available subcommands: ${availableSubcommands}\n\n` +
          `For more information, try '${cmd.name} --help'.`,
        cmd,
      );
    }

    // Recursive validation
    if (sub) {
      const subCmd = cmd.subcommands.get(sub.name);
      if (subCmd) {
        this.validate(subCmd, sub.matches);
      }
    }
  }

  private hydrate(cmd: Command, matches: ArgMatches): CommandInstance {
    if (!cmd.cls) {
      throw new ClepoError(
        ErrorKind.Internal,
        `Command '${cmd.name}' has no associated class.\n` +
          `    note: This is an internal error. Ensure the command was created via decorators or has 'cls' set.`,
        cmd,
      );
    }
    const instance = new cmd.cls() as Record<string, unknown>;

    for (const id of matches.ids()) {
      const argDef = cmd.args.get(id);
      if (!argDef) continue;

      const action = argDef.action ?? ArgAction.Set;

      if (action === ArgAction.Append || argDef.type === "list") {
        instance[id] = matches.getMany(id);
      } else if (action === ArgAction.Count) {
        instance[id] = matches.getCount(id);
      } else if (action === ArgAction.SetTrue || action === ArgAction.SetFalse) {
        instance[id] = matches.getFlag(id);
      } else {
        instance[id] = matches.getOne(id);
      }
    }

    const subMatch = matches.subcommandMatches();
    if (subMatch) {
      const subCmdDef = cmd.subcommands.get(subMatch.name);
      if (subCmdDef) {
        const subInstance = this.hydrate(subCmdDef, subMatch.matches);
        if (cmd.subcommandProperty) {
          instance[cmd.subcommandProperty] = subInstance;
        }
      }
    }

    return instance as unknown as CommandInstance;
  }

  private findLeaf(
    cmd: Command,
    matches: ArgMatches,
  ): { command: Command; matches: ArgMatches } {
    const sub = matches.subcommandMatches();
    if (sub) {
      const subCmd = cmd.subcommands.get(sub.name);
      if (subCmd) {
        return this.findLeaf(subCmd, sub.matches);
      }
    }
    return { command: cmd, matches };
  }

  private checkAction(
    cmd: Command,
    matches: ArgMatches,
    action: ArgAction,
  ): boolean {
    for (const arg of cmd.args.values()) {
      if (arg.action === action) {
        if (matches.contains(arg.id!)) return true;
      }
    }
    return false;
  }

  private findArg(
    cmd: Command,
    name: string,
    type: "short" | "long",
  ): Arg | undefined {
    for (const arg of cmd.args.values()) {
      if (type === "short" && arg.short === name) return arg;
      if (type === "long" && arg.long === name) return arg;
    }
    return undefined;
  }

  private argTakesMultiple(arg: Arg): boolean {
    return arg.action === ArgAction.Append || arg.type === "list";
  }

  private getArgName(arg: Arg): string {
    return arg.long ? `--${arg.long}` : (arg.short ? `-${arg.short}` : arg.id!);
  }

  private debugLog(...messages: string[]): void {
    if (this.debug) {
      for (const message of messages) {
        console.log(`[clepo parser] ${message}`);
      }
    }
  }
}
