import type { Helper } from "./types.ts";

/**
 * An abstraction for logging messages at different severity levels.
 */
export interface Log {
  /** Logs an informational message. */
  info(msg: string, ...args: unknown[]): void;
  /** Logs a warning message. */
  warn(msg: string, ...args: unknown[]): void;
  /** Logs an error message. */
  error(msg: string, ...args: unknown[]): void;
  /** Logs a debug message. */
  debug(msg: string, ...args: unknown[]): void;
}

/**
 * An abstraction for interacting with the file system.
 * This allows for swapping out the real file system with a mock or dry-run version.
 */
export interface FS {
  /** Reads the entire contents of a file as a string. */
  readTextFile(path: string): Promise<string>;
  /** Writes a string to a file, creating the file if it doesn't exist. */
  writeTextFile(path: string, content: string): Promise<void>;
  /** Checks if a file or directory exists. */
  exists(path: string): Promise<boolean>;
  /** Creates a new directory. */
  mkdir(path: string, options?: Deno.MkdirOptions): Promise<void>;
  /** Removes a file or directory. */
  remove(path: string, options?: Deno.RemoveOptions): Promise<void>;
}

/**
 * An abstraction for executing shell commands.
 */
export interface Shell {
  /**
   * Runs an external command and returns its output.
   * @param cmd An array where the first element is the command and subsequent elements are arguments.
   * @param options Configuration for the command execution.
   */
  run(
    cmd: string[],
    options?: Deno.CommandOptions,
  ): Promise<Deno.CommandOutput>;
}

/**
 * The execution context passed to a command's `run` method.
 * It provides access to I/O, environment, and other abstractions.
 */
export interface Context {
  /** The file system abstraction. */
  fs: FS;
  /** The shell command execution abstraction. */
  shell: Shell;
  /** The logging abstraction. */
  log: Log;
  /** A snapshot of the environment variables. */
  env: Record<string, string>;
  /** The current working directory. */
  cwd: string;
  /** A flag indicating if the command is running in dry-run mode. */
  dryRun: boolean;
  /** A collection of interactive helper functions. */
  helper: Helper;
}

// --- Implementations ---

/**
 * A `Log` implementation that writes messages to the console.
 */
export class ConsoleLogger implements Log {
  info(msg: string, ...args: unknown[]) {
    console.log(`%c[INFO] ${msg}`, "color: blue", ...args);
  }
  warn(msg: string, ...args: unknown[]) {
    console.warn(`%c[WARN] ${msg}`, "color: yellow", ...args);
  }
  error(msg: string, ...args: unknown[]) {
    console.error(`%c[ERROR] ${msg}`, "color: red", ...args);
  }
  debug(msg: string, ...args: unknown[]) {
    console.debug(`%c[DEBUG] ${msg}`, "color: gray", ...args);
  }
}

/**
 * An `FS` implementation that interacts directly with the host file system.
 */
export class RealFS implements FS {
  readTextFile(path: string): Promise<string> {
    return Deno.readTextFile(path);
  }
  writeTextFile(path: string, content: string): Promise<void> {
    return Deno.writeTextFile(path, content);
  }
  exists(path: string): Promise<boolean> {
    return Deno.stat(path).then(() => true).catch(() => false);
  }
  mkdir(path: string, options?: Deno.MkdirOptions): Promise<void> {
    return Deno.mkdir(path, options);
  }
  remove(path: string, options?: Deno.RemoveOptions): Promise<void> {
    return Deno.remove(path, options);
  }
}

/**
 * An `FS` implementation that logs file system operations instead of executing them.
 * Used when the `--dry-run` flag is present.
 */
export class DryRunFS implements FS {
  constructor(private logger: Log) {}

  readTextFile(path: string): Promise<string> {
    // In a real dry-run, reading is allowed.
    // However, if we are modifying a file we just "created" in memory,
    // we might need a virtual FS layer. For now, we read from disk.
    return Deno.readTextFile(path).catch((_e) => {
      this.logger.warn(
        `[DryRun] File not found on disk (might be created in this run): ${path}`,
      );
      return "";
    });
  }

  // deno-lint-ignore require-await
  async writeTextFile(path: string, content: string): Promise<void> {
    this.logger.info(
      `[DryRun] Would write to '${path}' (${content.length} bytes)`,
    );
  }

  async exists(path: string): Promise<boolean> {
    // Fallback to disk check
    return await Deno.stat(path).then(() => true).catch(() => false);
  }

  // deno-lint-ignore require-await
  async mkdir(path: string, options?: Deno.MkdirOptions): Promise<void> {
    this.logger.info(`[DryRun] Would create directory '${path}'`, options);
  }

  // deno-lint-ignore require-await
  async remove(path: string, options?: Deno.RemoveOptions): Promise<void> {
    this.logger.info(`[DryRun] Would remove '${path}'`, options);
  }
}

/**
 * A `Shell` implementation that executes commands directly on the host system.
 */
export class RealShell implements Shell {
  async run(
    cmd: string[],
    options?: Deno.CommandOptions,
  ): Promise<Deno.CommandOutput> {
    const command = new Deno.Command(cmd[0], {
      args: cmd.slice(1),
      ...options,
    });
    return await command.output();
  }
}

/**
 * A `Shell` implementation that logs commands instead of executing them.
 * Used when the `--dry-run` flag is present.
 */
export class DryRunShell implements Shell {
  constructor(private logger: Log) {}

  // deno-lint-ignore require-await
  async run(
    cmd: string[],
    options?: Deno.CommandOptions,
  ): Promise<Deno.CommandOutput> {
    this.logger.info(
      `[DryRun] Would execute command: ${cmd.join(" ")}`,
      options,
    );
    // Return a fake success
    return {
      code: 0,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
      success: true,
      signal: null,
    };
  }
}
