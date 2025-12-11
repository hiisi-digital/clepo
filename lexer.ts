// loru/packages/clepo/lexer.ts

/**
 * An iterator for walking through a cluster of short flags, like `-abc`.
 * This is created by `ParsedArg.toShort()`.
 */
export class ShortFlags {
  private remaining: string;
  public readonly raw: string;

  constructor(cluster: string) {
    this.raw = cluster;
    this.remaining = cluster;
  }

  /**
   * Checks if the original cluster looks like a number (e.g., "123" from "-123").
   * This should be called before iterating flags.
   */
  public isNegativeNumber(): boolean {
    // A simple regex to check for integer or float values.
    // It doesn't need to be perfect, just good enough to distinguish from flags.
    return /^\d+(\.\d*)?$/.test(this.remaining);
  }

  /**
   * Returns the next flag character from the cluster.
   * @returns The next character, or undefined if the cluster is exhausted.
   */
  public nextFlag(): string | undefined {
    if (this.remaining.length === 0) {
      return undefined;
    }
    const flag = this.remaining[0];
    this.remaining = this.remaining.slice(1);
    return flag;
  }

  /**
   * Consumes the rest of the cluster as a single value.
   * This is used when a short flag expects a value, like `-j4` where `j` takes `4`.
   * @returns The remaining part of the cluster, or undefined if empty.
   */
  public nextValue(): string | undefined {
    if (this.remaining.length === 0) {
      return undefined;
    }
    const value = this.remaining;
    this.remaining = ""; // Consume the rest
    return value;
  }
}

/**
 * Represents a single, uninterpreted command-line argument.
 *
 * This class provides methods to query the type of the argument (is it a long
 * flag, a short flag, etc.?) and to extract its components. It corresponds to
 * `clap_lex::ParsedArg` and is designed to be "dumb," leaving semantic
 * interpretation to the `Parser`.
 */
export class ParsedArg {
  constructor(public readonly raw: string) {}

  /** Checks if the argument is `--`. */
  public isEscape(): boolean {
    return this.raw === "--";
  }

  /** Checks if the argument is `-`. */
  public isStdio(): boolean {
    return this.raw === "-";
  }

  /**
   * Checks if the argument looks like a long flag (e.g., `--foo`).
   * This does not include the escape sequence `--`.
   */
  public isLong(): boolean {
    return this.raw.startsWith("--") && !this.isEscape();
  }

  /**
   * Attempts to parse the argument as a long flag.
   * @returns A tuple `[flag, value]` or `undefined`.
   *   - `flag`: The name of the flag (e.g., "foo" from `--foo=bar`).
   *   - `value`: The value if provided with an equals sign, otherwise `undefined`.
   * Returns `undefined` if it's not a long flag.
   */
  public toLong(): [string, string | undefined] | undefined {
    if (!this.isLong()) {
      return undefined;
    }

    const content = this.raw.slice(2);
    const eqIndex = content.indexOf("=");

    if (eqIndex !== -1) {
      const key = content.slice(0, eqIndex);
      const value = content.slice(eqIndex + 1);
      return [key, value];
    }

    return [content, undefined];
  }

  /**
   * Checks if the argument looks like a short flag (e.g., `-f`, `-vv`).
   * This does not include stdio (`-`) or negative numbers (`-123`).
   */
  public isShort(): boolean {
    return this.raw.startsWith("-") &&
      !this.isStdio() &&
      !this.isLong() &&
      !this.isNegativeNumber();
  }

  /**
   * Attempts to parse the argument as one or more short flags.
   * @returns A `ShortFlags` iterator for the cluster, or `undefined` if it's not a short flag.
   */
  public toShort(): ShortFlags | undefined {
    if (!this.isShort()) {
      return undefined;
    }
    const content = this.raw.slice(1);
    return new ShortFlags(content);
  }

  /**
   * Checks if the argument looks like a negative number (e.g., `-1`, `-3.14`).
   * This is crucial to distinguish from a short flag.
   */
  public isNegativeNumber(): boolean {
    return /^-(\d+(\.\d*)?|\.\d+)$/.test(this.raw);
  }

  /** Returns the raw inner string of the argument. */
  public toValue(): string {
    return this.raw;
  }
}

/**
 * A cursor representing the current position within `RawArgs`.
 */
export class ArgCursor {
  public index = 0;
}

/**
 * A low-level, cursor-based container for raw command-line arguments.
 *
 * This class corresponds to `clap_lex::RawArgs`. The parser interacts with this
 * object to iterate through arguments, peek ahead, and manage the parsing position
 * via an `ArgCursor`.
 */
export class RawArgs {
  constructor(private readonly items: string[]) {}

  /**
   * Creates a new cursor for iterating over these arguments.
   */
  public cursor(): ArgCursor {
    return new ArgCursor();
  }

  /**
   * Retrieves the next argument as a `ParsedArg` and advances the cursor.
   * @param cursor The cursor to use and advance.
   * @returns A `ParsedArg` or `undefined` if at the end.
   */
  public next(cursor: ArgCursor): ParsedArg | undefined {
    const arg = this.items[cursor.index];
    if (arg !== undefined) {
      cursor.index++;
      return new ParsedArg(arg);
    }
    return undefined;
  }

  /**
   * Retrieves the next argument as a raw string and advances the cursor.
   * @param cursor The cursor to use and advance.
   * @returns The argument string or `undefined`.
   */
  public nextRaw(cursor: ArgCursor): string | undefined {
    const arg = this.items[cursor.index];
    if (arg !== undefined) {
      cursor.index++;
    }
    return arg;
  }

  /**
   * Peeks at the next argument as a `ParsedArg` without advancing the cursor.
   * @param cursor The cursor to peek from.
   * @returns A `ParsedArg` or `undefined` if at the end.
   */
  public peek(cursor: ArgCursor): ParsedArg | undefined {
    const arg = this.items[cursor.index];
    return arg !== undefined ? new ParsedArg(arg) : undefined;
  }

  /**
   * Consumes all remaining arguments and advances the cursor to the end.
   * @param cursor The cursor to use.
   * @returns An array of the remaining argument strings.
   */
  public remaining(cursor: ArgCursor): string[] {
    const remainingItems = this.items.slice(cursor.index);
    cursor.index = this.items.length;
    return remainingItems;
  }
}
