// loru/packages/clepo/decorators.ts

import { Arg as ArgClass } from "./arg.ts";
import { Command as CommandBuilder, type CommandConfig } from "./command.ts";
import { reflect, type SubcommandInfo } from "./reflect.ts";

/**
 * Symbol used to identify SubcommandsMarker objects at runtime.
 * @internal
 */
export const SUBCOMMANDS_MARKER = Symbol("clepo:subcommands_marker");

/**
 * A marker type that holds subcommand class information.
 * This is the internal representation used by the `Subcommands()` function.
 * At type-level it represents the union of instances, but at runtime it's a metadata carrier.
 */
export interface SubcommandsMarker<
  // deno-lint-ignore no-explicit-any
  T extends (new () => any)[],
> {
  [SUBCOMMANDS_MARKER]: true;
  __classes: T;
}

/**
 * The return type of the `Subcommands()` function.
 * This is a branded type that:
 * 1. At the type level, represents the union of command instances
 * 2. Has a brand that allows it to be recognized by the @Subcommand decorator
 * 3. At runtime, is actually a SubcommandsMarker object
 */
// deno-lint-ignore no-explicit-any
export type SubcommandsResult<T extends (new () => any)[]> =
  & InstanceType<T[number]>
  & { readonly __subcommandsBrand: T };

/**
 * Checks if a value is a SubcommandsMarker.
 * @internal
 */
export function isSubcommandsMarker(
  value: unknown,
  // deno-lint-ignore no-explicit-any
): value is SubcommandsMarker<any> {
  return (
    typeof value === "object" &&
    value !== null &&
    SUBCOMMANDS_MARKER in value
  );
}

/**
 * Creates a subcommand "enum" from a list of command classes.
 * This is the TypeScript equivalent of Rust's `#[derive(Subcommand)] enum`.
 *
 * The returned value is typed as a union of the command class instances,
 * allowing for a clap-like API where the type annotation is minimal.
 *
 * @example
 * ```typescript
 * // Define subcommand classes
 * @Command({ about: "Clones repos" })
 * class Clone {
 *   @Arg({ positional: true })
 *   remote!: string;
 * }
 *
 * @Command({ about: "Shows diff" })
 * class Diff {
 *   @Arg() base?: string;
 * }
 *
 * // Create the "enum"
 * const Commands = Subcommands(Clone, Diff);
 *
 * // Use in main CLI class
 * @Command({ name: "git", version: "1.0.0" })
 * class GitCli {
 *   command = Commands;  // Type is automatically Clone | Diff
 * }
 * ```
 *
 * @param classes The subcommand class constructors to include.
 * @returns A marker that is typed as the union of command instances.
 */
// deno-lint-ignore no-explicit-any
export function Subcommands<T extends (new () => any)[]>(
  ...classes: T
): SubcommandsResult<T> {
  const marker: SubcommandsMarker<T> = {
    [SUBCOMMANDS_MARKER]: true,
    __classes: classes,
  };
  // Cast to the branded type for TypeScript's benefit.
  // At runtime, this is the marker object which is detected by getCommand().
  return marker as unknown as SubcommandsResult<T>;
}

/**
 * Checks if a value has the subcommands brand (for decorator type checking).
 * @internal
 */
function hasSubcommandsBrand(
  value: unknown,
): value is { readonly __subcommandsBrand: unknown } {
  // At runtime, we check for the marker symbol, not the brand (which is type-only)
  return isSubcommandsMarker(value);
}

/**
 * Converts a camelCase or PascalCase string to kebab-case.
 * @internal
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Class decorator that marks a class as a command and provides its configuration.
 * @param config The configuration for the command.
 */
export function Command(config: CommandConfig = {}): ClassDecorator {
  // deno-lint-ignore ban-types
  return (target: Function) => {
    // Attach the command configuration metadata to the class constructor.
    reflect.setCommand(target, config);
  };
}

/**
 * A type alias to allow the `long` property to accept `true` as a shorthand
 * in the `@Arg` decorator.
 * @internal
 */
type ArgConfigShorthand = Omit<Partial<ArgClass>, "long"> & {
  long?: string | boolean;
};

/**
 * Property decorator that defines a command-line argument.
 * @param config The configuration for the argument.
 */
export function Arg(config: ArgConfigShorthand = {}): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const key = String(propertyKey);

    // Create a new Arg instance, passing the config but omitting the `long`
    // property for now, as it might be a boolean.
    const arg = new ArgClass(config as Partial<ArgClass>);

    // Initialize the argument with reflection to infer types from the property.
    arg.init(target, key);

    // Handle the `long: true` shorthand to infer a kebab-case name.
    if (config.long === true) {
      arg.long = toKebabCase(key);
    } else if (typeof config.long === "string") {
      // If `long` is already a string, just assign it.
      arg.long = config.long;
    }

    // Add the fully configured argument to the class's metadata.
    // Note: reflect.addArg normalizes to constructor internally.
    reflect.addArg(target, arg);
  };
}

/**
 * Property decorator that registers one or more subcommand classes to a parent command.
 * The parsed subcommand instance will be injected into this property.
 *
 * This decorator accepts three forms:
 * 1. An array of subcommand class constructors: `@Subcommand([Clone, Diff])`
 * 2. A SubcommandsMarker from the `Subcommands()` function: `@Subcommand(Commands)`
 * 3. No arguments: `@Subcommand()` - the subcommands will be detected from the property initializer
 *
 * @example
 * ```typescript
 * // Form 1: Array of classes (original API)
 * @Subcommand([Clone, Diff])
 * command!: Clone | Diff;
 *
 * // Form 2: Using Subcommands() helper
 * const Commands = Subcommands(Clone, Diff);
 * @Subcommand(Commands)
 * command = Commands;
 *
 * // Form 3: Auto-detection (no decorator argument needed)
 * const Commands = Subcommands(Clone, Diff);
 * @Subcommand()
 * command = Commands;
 *
 * // Form 4: Full auto-detection (no decorator at all!)
 * const Commands = Subcommands(Clone, Diff);
 * command = Commands;  // getCommand() will detect this automatically
 * ```
 *
 * @param subcommandClasses An array of subcommand classes or a SubcommandsMarker.
 */
export function Subcommand(
  // deno-lint-ignore no-explicit-any
  subcommandClasses?: (new () => any)[] | SubcommandsMarker<any> | SubcommandsResult<any>,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const key = String(propertyKey);

    // deno-lint-ignore no-explicit-any
    let classes: (new () => any)[];

    if (isSubcommandsMarker(subcommandClasses) || hasSubcommandsBrand(subcommandClasses)) {
      // Both SubcommandsMarker and SubcommandsResult are backed by the same runtime object
      // deno-lint-ignore no-explicit-any
      classes = (subcommandClasses as SubcommandsMarker<any>).__classes;
    } else if (Array.isArray(subcommandClasses)) {
      classes = subcommandClasses;
    } else {
      // No argument provided - mark this as a subcommand property for auto-detection.
      // The actual classes will be detected from the initializer in getCommand().
      reflect.markSubcommandProperty(target, key);
      return;
    }

    // Register each class as a subcommand.
    for (const cls of classes) {
      const info: SubcommandInfo = {
        property: key,
        class: cls,
      };
      // Note: reflect.addSubcommand normalizes to constructor internally.
      reflect.addSubcommand(target, info);
    }
  };
}

/**
 * Retrieves the fully constructed Command builder from a decorated class.
 * This function also auto-detects SubcommandsMarker properties that weren't
 * explicitly registered via @Subcommand decorator.
 *
 * @param target The class constructor.
 */
export function getCommand(target: new () => unknown): CommandBuilder {
  // reflect methods normalize targets internally, so we can pass the constructor directly.
  const config = reflect.getCommand(target) ?? {};
  const name = config.name ?? toKebabCase(target.name);
  const cmd = new CommandBuilder(name);

  cmd.cls = target;

  if (config.version) cmd.setVersion(config.version);
  if (config.about) cmd.setAbout(config.about);
  if (config.longAbout) cmd.setLongAbout(config.longAbout);
  if (config.aliases) {
    cmd.aliases = config.aliases;
  }
  if (config.settings) {
    for (const setting of config.settings) {
      cmd.setting(setting);
    }
  }

  // Get arguments - pass constructor directly, reflect handles normalization.
  const args = reflect.getArgs(target);
  for (const arg of args) {
    cmd.addArg(arg);
  }

  // Auto-detect SubcommandsMarker properties by creating a temporary instance.
  // This allows usage without any @Subcommand decorator at all.
  detectSubcommandsFromInstance(target);

  // Get subcommands - pass constructor directly, reflect handles normalization.
  const subcommands = reflect.getSubcommands(target);
  for (const info of subcommands) {
    const subCmd = getCommand(info.class);
    cmd.addSubcommand(subCmd);
    cmd.subcommandProperty = info.property;
  }

  return cmd;
}

/**
 * Detects SubcommandsMarker values from a class's property initializers
 * and registers them as subcommands if not already registered.
 * @internal
 */
function detectSubcommandsFromInstance(target: new () => unknown): void {
  // Create a temporary instance to access property initializers.
  // This is necessary because experimental decorators don't have access to initializers.
  const tempInstance = new target();
  const existingSubcommands = reflect.getSubcommands(target);

  for (const key of Object.getOwnPropertyNames(tempInstance)) {
    // deno-lint-ignore no-explicit-any
    const value = (tempInstance as any)[key];

    if (isSubcommandsMarker(value)) {
      // Check if this property was already registered via @Subcommand.
      const alreadyRegistered = existingSubcommands.some(
        (s) => s.property === key,
      );

      if (!alreadyRegistered) {
        // Register each class from the marker as a subcommand.
        for (const cls of value.__classes) {
          const info: SubcommandInfo = {
            property: key,
            class: cls,
          };
          reflect.addSubcommand(target, info);
        }
      }
    }
  }
}

/**
 * Property decorator that restricts the argument to a set of values from a TypeScript Enum.
 * @param enumObj The enum object.
 */
export function ValueEnum(enumObj: object): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const key = String(propertyKey);
    const possibleValues = Array.from(
      new Set(
        Object.values(enumObj).filter((val) => typeof val === "string"),
      ),
    ) as string[];

    const arg = new ArgClass({ id: key, possibleValues });
    // Initialize to get type information from reflection.
    arg.init(target, key);
    reflect.addArg(target, arg);
  };
}
