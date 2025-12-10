// loru/packages/clepo/decorators.ts

// loru/packages/clepo/decorators.ts

import type { Arg as ArgConfig } from "./arg.ts";
import { Command as CommandBuilder } from "./command.ts";
import type { CommandConfig } from "./command.ts";
import { ClepoError, ErrorKind } from "./error.ts";

// The global registry mapping class constructors to their Command builder instances.
// This is the heart of the decorator-based API.
// deno-lint-ignore no-explicit-any
const REGISTRY = new Map<any, CommandBuilder>();

/**
 * Retrieves or initializes the Command builder for a given class constructor.
 *
 * This function is the central point of contact for the decorator system. When a
 * decorator is applied to a class or its property, this function is used to get
 * the underlying `Command` instance that holds the CLI's configuration. If an
 * instance doesn't exist for a given class, it's created and stored in the
 * global `REGISTRY`.
 *
 * @param target The class constructor.
 * @returns The `Command` builder instance for the class.
 */
// deno-lint-ignore no-explicit-any
export function getCommand(target: any): CommandBuilder {
  let command = REGISTRY.get(target);
  if (!command) {
    // Default the command name to the class name (lowercase).
    // The @Command decorator will override this if a name is provided in its config.
    const name = target.name.toLowerCase();
    command = new CommandBuilder(name);
    // Associate the class constructor with the command for later instantiation.
    command.cls = target;
    REGISTRY.set(target, command);
  }
  return command;
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
 * class MyCli implements CommandInstance {
 *   async run(ctx: Context) { console.log("Hello, world!"); }
 * }
 * ```
 */
export function Command(config: CommandConfig = {}): ClassDecorator {
  // deno-lint-ignore no-explicit-any
  return function (target: any) {
    const command = getCommand(target);

    // Apply configuration from the decorator to the Command instance
    if (config.name) command.name = config.name;
    if (config.version) command.setVersion(config.version);
    if (config.about) command.setAbout(config.about);
    if (config.longAbout) command.setLongAbout(config.longAbout);

    // Apply any behavioral settings
    if (config.settings) {
      for (const setting of config.settings) {
        command.setting(setting);
      }
    }

    // Register any subcommands provided in the config array.
    // Note: The `@Subcommand` decorator is the preferred way to do this.
    if (config.subcommands) {
      registerSubcommands(command, config.subcommands);
    }
  };
}

/**
 * Property decorator for defining a command-line argument (a flag, option, or positional).
 * The behavior of the argument is determined by the configuration provided.
 *
 * @example
 * ```typescript
 * class MyCli {
 *   @Arg({ short: "v", long: true, help: "Enable verbose mode" })
 *   verbose = false;
 *
 *   @Arg({ required: true, help: "The input file to process" })
 *   inputFile!: string;
 * }
 * ```
 */
export function Arg(config: ArgConfig = {}): PropertyDecorator {
  return function (target: unknown, propertyKey: string | symbol) {
    if (typeof target !== "object" || target === null) return;
    const constructor = (target as Record<string, unknown>).constructor;
    const command = getCommand(constructor);
    const name = String(propertyKey);

    // Create a mutable copy to avoid modifying the user's original config object.
    const argConfig = { ...config };

    // Default the argument's ID to the property name. This is crucial for mapping
    // the parsed value back to the class instance.
    if (!argConfig.id) {
      argConfig.id = name;
    }

    // If `long: true`, automatically generate the kebab-case long flag name
    // from the property's camelCase name.
    if (argConfig.long === true) {
      argConfig.long = toKebabCase(name);
    }

    command.addArg(argConfig);
  };
}

/**
 * Decorator to register one or more subcommand classes to a parent command.
 * It can be used as a class decorator or a property decorator. When used as a
 * property decorator, the parsed subcommand instance will be injected into that property.
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
  subcommandClasses: (new () => unknown)[],
): ClassDecorator | PropertyDecorator {
  return function (target: unknown, propertyKey?: string | symbol) {
    const command = getCommand(
      propertyKey ? (target as { constructor: unknown }).constructor : target,
    );
    registerSubcommands(command, subcommandClasses);

    // If used as a property decorator, store the property key so the parser knows
    // where to inject the subcommand instance after parsing.
    if (propertyKey) {
      command.subcommandProperty = String(propertyKey);
    }
  };
}

/** Helper function to register subcommand classes with a parent command. */
function registerSubcommands(
  parentCommand: CommandBuilder,
  subcommandClasses: (new () => unknown)[],
) {
  for (const subCls of subcommandClasses) {
    const subCommand = getCommand(subCls);
    parentCommand.addSubcommand(subCommand);
  }
}

/**
 * Property decorator used to restrict an argument's values to a specific set,
 * often derived from a TypeScript enum. This decorator must be placed *after* `@Arg`.
 *
 * @param values An array of strings or a TypeScript string enum.
 *
 * @example
 * ```typescript
 * enum LogLevel { Info = "info", Warn = "warn" }
 *
 * class MyCli {
 *   @Arg({ long: true })
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
    const command = getCommand(constructor);
    const name = String(propertyKey);

    const arg = command.args.get(name);
    if (!arg) {
      // Decorators run in reverse order of their appearance.
      // Throw a structured error to guide the user to place @ValueEnum after @Arg.
      throw new ClepoError(
        ErrorKind.Internal,
        `Decorator error on property "${name}": @ValueEnum must be placed after an @Arg decorator.`,
      );
    }

    let possibleValues: string[];
    if (Array.isArray(values)) {
      possibleValues = values.map(String);
    } else {
      // This handles TypeScript string enums or other string-valued objects.
      possibleValues = Object.values(values).filter((v) =>
        typeof v === "string"
      ) as string[];
    }

    arg.possibleValues = possibleValues;
  };
}

/**
 * Converts a camelCase or PascalCase string to kebab-case.
 * @internal
 */
function toKebabCase(str: string): string {
  // This regex handles cases where an uppercase letter is followed by a lowercase one,
  // preventing "--f-oo-bar" from "fooBar" and correctly producing "--foo-bar".
  // It also handles acronyms like "URL" becoming "url".
  return str
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2")
    .toLowerCase();
}
