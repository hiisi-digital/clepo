import type { Helper } from "./types.ts";

export interface Log {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
}

export interface FS {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: Deno.MkdirOptions): Promise<void>;
  remove(path: string, options?: Deno.RemoveOptions): Promise<void>;
}

export interface Shell {
  run(
    cmd: string[],
    options?: Deno.CommandOptions,
  ): Promise<Deno.CommandOutput>;
}

export interface Context {
  fs: FS;
  shell: Shell;
  log: Log;
  env: Record<string, string>;
  cwd: string;
  dryRun: boolean;
  helper: Helper;
}

// --- Implementations ---

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
