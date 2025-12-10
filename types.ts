import type { Context } from "./context.ts";

export interface CommandConfig {
  name: string;
  about?: string;
  longAbout?: string;
  aliases?: string[];
  mutable?: boolean; // If true, requires --dry-run handling
  hidden?: boolean;
  // deno-lint-ignore no-explicit-any
  subcommands?: (new () => any)[]; // Constructors of subcommands
}

export interface ArgConfig {
  name?: string; // If not provided, property name is used
  help?: string;
  short?: string; // e.g. 'v' for -v
  long?: string; // e.g. 'verbose' for --verbose
  required?: boolean;
  default?: unknown;
  type?: "string" | "number" | "boolean" | "list";
}

export interface OptionConfig extends ArgConfig {
  // Option specific (flags)
  global?: boolean;
}

export interface PositionalConfig extends ArgConfig {
  index?: number;
}

export interface CommandInstance {
  run(ctx: Context): Promise<void>;
}

export interface CommandMetadata {
  // deno-lint-ignore no-explicit-any
  cls: new () => any; // CommandInstance;
  config: CommandConfig;
  args: Map<string | symbol, ArgConfig>;
  subcommands: Map<string, CommandMetadata>;
  parent?: CommandMetadata;
}

export interface Helper {
  // Helper functions exposed to commands via Context
  confirm(msg: string): Promise<boolean>;
  prompt(msg: string, defaultValue?: string): Promise<string>;
}
