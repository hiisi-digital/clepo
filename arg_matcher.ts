import type { Arg } from "./arg.ts";

/**
 * The source of the value for an argument.
 */
export enum ValueSource {
  /** The value came from a default value in the definition. */
  DefaultValue,
  /** The value came from an environment variable. */
  EnvVariable,
  /** The value came explicitly from the command line. */
  CommandLine,
}

/**
 * Represents the collected data for a single argument after parsing.
 */
export interface MatchedArg {
  /** The unique identifier of the argument. */
  id: string;
  /** The indices in the raw argument list where this argument appeared. */
  indices: number[];
  /** The parsed values associated with this argument. */
  vals: unknown[];
  /** The number of times this argument appeared. */
  occurrences: number;
  /** Where the value originated from. */
  source: ValueSource;
}

/**
 * The final result of a parsing operation.
 *
 * This object holds all the matched arguments, their values, and any matched subcommand.
 * It is effectively read-only once created by the parser.
 */
export class ArgMatches {
  private args: Map<string, MatchedArg>;
  private subcommand?: { name: string; matches: ArgMatches };

  constructor(
    args: Map<string, MatchedArg>,
    subcommand?: { name: string; matches: ArgMatches },
  ) {
    this.args = args;
    this.subcommand = subcommand;
  }

  /**
   * Checks if an argument was present (either via CLI, env, or default).
   */
  public contains(id: string): boolean {
    return this.args.has(id);
  }

  /**
   * Gets the value of an argument. If multiple values are present, returns the first one.
   */
  public getOne<T>(id: string): T | undefined {
    const matched = this.args.get(id);
    if (!matched || matched.vals.length === 0) {
      return undefined;
    }
    return matched.vals[0] as T;
  }

  /**
   * Gets all values for an argument.
   */
  public getMany<T>(id: string): T[] | undefined {
    const matched = this.args.get(id);
    if (!matched) {
      return undefined;
    }
    return matched.vals as T[];
  }

  /**
   * Gets the boolean value of a flag.
   *
   * Returns `true` if the flag is present (and not `SetFalse`), or if the value is explicitly `true`.
   */
  public getFlag(id: string): boolean {
    const matched = this.args.get(id);
    if (!matched) {
      return false;
    }
    // If we have explicit boolean values (e.g. from SetTrue/SetFalse actions), use them.
    if (matched.vals.length > 0 && typeof matched.vals[0] === "boolean") {
      return matched.vals[0] as boolean;
    }
    // Otherwise, presence usually implies true for flags.
    return matched.occurrences > 0;
  }

  /**
   * Gets the count of occurrences for a flag (e.g. `-vvv`).
   */
  public getCount(id: string): number {
    return this.args.get(id)?.occurrences ?? 0;
  }

  /**
   * Gets the index of the first occurrence of this argument.
   */
  public index(id: string): number | undefined {
    const matched = this.args.get(id);
    if (matched && matched.indices.length > 0) {
      return matched.indices[0];
    }
    return undefined;
  }

  /**
   * Gets the matched subcommand, if any.
   */
  public subcommandMatches():
    | { name: string; matches: ArgMatches }
    | undefined {
    return this.subcommand;
  }

  /**
   * Returns an iterator over all matched argument IDs.
   */
  public ids(): IterableIterator<string> {
    return this.args.keys();
  }
}

/**
 * A mutable helper used by the Parser to accumulate argument matches during parsing.
 *
 * This separates the "write" phase (parsing) from the "read" phase (consumption).
 */
export class ArgMatcher {
  private args: Map<string, MatchedArg> = new Map();
  private subcommand?: { name: string; matches: ArgMatches };

  constructor() {}

  /**
   * Checks if an argument has already been matched.
   */
  public contains(id: string): boolean {
    return this.args.has(id);
  }

  /**
   * Gets the mutable match data for an argument.
   */
  public get(id: string): MatchedArg | undefined {
    return this.args.get(id);
  }

  /**
   * Removes an argument match. This is used for overrides (e.g. later flags overriding earlier ones).
   */
  public remove(id: string): void {
    this.args.delete(id);
  }

  /**
   * Initializes a custom argument match entry if it doesn't exist.
   * This is typically called when an argument is encountered for the first time.
   */
  public startCustomArg(arg: Arg, source: ValueSource): void {
    if (!this.args.has(arg.id!)) {
      this.args.set(arg.id!, {
        id: arg.id!,
        indices: [],
        vals: [],
        occurrences: 0,
        source,
      });
    }
  }

  /**
   * Adds a value to a matched argument.
   */
  public addValTo(id: string, val: unknown): void {
    const matched = this.args.get(id);
    if (matched) {
      matched.vals.push(val);
    }
  }

  /**
   * Adds an index to a matched argument (indicating where it appeared in the arg list).
   */
  public addIndexTo(id: string, index: number): void {
    const matched = this.args.get(id);
    if (matched) {
      matched.indices.push(index);
    }
  }

  /**
   * Increments the occurrence count for an argument.
   */
  public incOccurrenceOf(id: string): void {
    const matched = this.args.get(id);
    if (matched) {
      matched.occurrences++;
    }
  }

  /**
   * Sets the matched subcommand.
   */
  public setSubcommand(name: string, matches: ArgMatches): void {
    this.subcommand = { name, matches };
  }

  /**
   * Converts this mutable matcher into a read-only ArgMatches object.
   */
  public intoInner(): ArgMatches {
    return new ArgMatches(this.args, this.subcommand);
  }
}
