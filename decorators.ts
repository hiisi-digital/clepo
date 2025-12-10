import type { Arg, CommandConfig, CommandMetadata } from "./types.ts";

// deno-lint-ignore no-explicit-any
const REGISTRY = new Map<any, CommandMetadata>();

/**
 * Retrieves or initializes the command metadata for a given class constructor.
 * This is an internal utility function for the decorator system.
 * @param target The class constructor.
 * @returns The metadata object for the command.
 */
// deno-lint-ignore no-explicit-any
export function getCommandMetadata(target: any): CommandMetadata {
  let meta = REGISTRY.get(target);
  if (!meta) {
    meta = {
      cls: target,
      config: {},
      args: new Map(),
      subcommands: new Map(),
    };
    REGISTRY.set(target, meta);
  }
  return meta;
}

/**
 * Class decorator that marks a class as a command-line interface command.
 * It configures the command's name, version, and description.
 *
 * @example
 * ```typescript
 * @Command({
 *   name: "my-cli",
 *   version: "1.0.0",
 *   about: "A cool command-line tool."
 * })
 * class MyCli {}
 * ```
 */
export function Command(config: CommandConfig = {}): ClassDecorator {
  // deno-lint-ignore no-explicit-any
  return function (target: any) {
    const meta = getCommandMetadata(target);
    meta.config = { ...meta.config, ...config };

    // Default name to class name if not set
    if (!meta.config.name) {
      meta.config.name = target.name.toLowerCase();
    }

    // Register explicitly provided subcommands from config
    if (config.subcommands) {
      registerSubcommands(meta, config.subcommands);
    }
  };
}

/**
 * Decorator to register one or more subcommand classes to a parent command.
 * It can be used as a class decorator or a property decorator.
 *
 * @example
 * ```typescript
 * @Command({ name: "git" })
 * class Git {
 *   @Subcommand([Commit, Push])
 *   command!: Commit | Push;
 * }
 * ```
 */
export function Subcommand(
  subcommands: (new () => unknown)[],
): ClassDecorator | PropertyDecorator {
  return function (target: unknown, propertyKey?: string | symbol) {
    if (typeof propertyKey === "undefined") {
      // Class Decorator
      const meta = getCommandMetadata(target);
      registerSubcommands(meta, subcommands);
    } else {
      // Property Decorator
      // target is prototype for instance properties
      if (typeof target !== "object" || target === null) return;
      const constructor = (target as Record<string, unknown>).constructor;
      const meta = getCommandMetadata(constructor);
      registerSubcommands(meta, subcommands);

      // Mark this property as the one to hold the executed subcommand instance
      // We store this in a custom property on the metadata object
      (meta as CommandMetadata & { subcommandProperty?: unknown })
        .subcommandProperty = propertyKey;
    }
  };
}

function registerSubcommands(
  meta: CommandMetadata,
  subcommands: (new () => unknown)[],
) {
  for (const sub of subcommands) {
    const subMeta = getCommandMetadata(sub);
    subMeta.parent = meta;

    // Use the class name as default name if not provided in config (yet)
    // If the child class hasn't been decorated yet, config.name might be undefined.
    // We can default it here, and @Command will override/confirm it later.
    if (!subMeta.config.name) {
      subMeta.config.name = sub.name.toLowerCase();
    }

    meta.subcommands.set(subMeta.config.name, subMeta);

    // Register aliases
    if (subMeta.config.aliases) {
      for (const alias of subMeta.config.aliases) {
        meta.subcommands.set(alias, subMeta);
      }
    }
  }
}

/**
 * Property decorator for defining a command-line argument (a flag, option, or positional).
 * The behavior of the argument is determined by the configuration provided.
 *
 * @example
 * ```typescript
 * class MyCli {
 *   // A boolean flag: --verbose or -v
 *   @Arg({ short: "v", long: true, help: "Enable verbose mode" })
 *   verbose = false;
 *
 *   // A required positional argument
 *   @Arg({ required: true, help: "The input file to process" })
 *   inputFile!: string;
 * }
 * ```
 */
export function Arg(config: Arg = {}): PropertyDecorator {
  return function (target: unknown, propertyKey: string | symbol) {
    if (typeof target !== "object" || target === null) return;
    const constructor = (target as Record<string, unknown>).constructor;
    const meta = getCommandMetadata(constructor);
    const name = String(propertyKey);

    // Default ID to property name
    if (!config.id) {
      config.id = name;
    }

    // Default long flag to kebab-case of property name if true
    if (config.long === true) {
      config.long = toKebabCase(name);
    }

    meta.args.set(name, config);
  };
}

/**
 * Property decorator used to restrict an argument's values to a specific set,
 * often derived from a TypeScript enum.
 *
 * @param values An array of strings or a TypeScript string enum.
 *
 * @example
 * ```typescript
 * enum LogLevel {
 *   Info = "info",
 *   Warn = "warn",
 *   Error = "error",
 * }
 *
 * class MyCli {
 *   @Arg({ long: true, help: "Set the log level" })
 *   @ValueEnum(LogLevel)
 *   logLevel: LogLevel = LogLevel.Info;
 * }
 * ```
 */
export function ValueEnum(
  values: unknown[] | Record<string, unknown>,
): PropertyDecorator {
  return function (target: unknown, propertyKey: string | symbol) {
    if (typeof target !== "object" || target === null) return;
    const constructor = (target as Record<string, unknown>).constructor;
    const meta = getCommandMetadata(constructor);
    const name = String(propertyKey);

    const arg = meta.args.get(name) || { id: name };

    let possibleValues: string[] = [];
    if (Array.isArray(values)) {
      possibleValues = values.map(String);
    } else {
      // Handle TS String Enum or Object
      possibleValues = Object.values(values).filter((v) =>
        typeof v === "string"
      ) as string[];
    }

    arg.possibleValues = possibleValues;
    meta.args.set(name, arg);
  };
}

/**
 * Converts a camelCase or PascalCase string to kebab-case.
 * @internal
 */
function toKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
