import { type Context } from "./context.ts";

export interface CommandConfig {
  name: string;
  about?: string;
  longAbout?: string;
  aliases?: string[];
  mutable?: boolean;
  hidden?: boolean;
  subcommands?: (new () => any)[];
}

export interface ArgConfig {
  name?: string;
  help?: string;
  short?: string;
  long?: string;
  required?: boolean;
  default?: unknown;
  type?: "string" | "number" | "boolean" | "list";
}

export interface OptionConfig extends ArgConfig {
  global?: boolean;
}

export interface PositionalConfig extends ArgConfig {
  index?: number;
}

export interface CommandInstance {
  run(ctx: Context): Promise<void>;
}

export interface CommandMetadata {
  cls: new () => any;
  config: CommandConfig;
  args: Map<string | symbol, ArgConfig>;
  subcommands: Map<string, CommandMetadata>;
  parent?: CommandMetadata;
}

export interface Helper {
  confirm(msg: string): Promise<boolean>;
  prompt(msg: string, defaultValue?: string): Promise<string>;
}
