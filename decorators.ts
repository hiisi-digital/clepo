// loru/packages/clepo/decorators.ts

import { Arg as ArgClass } from "./arg.ts";
import { Command as CommandBuilder, type CommandConfig } from "./command.ts";
import { reflect, type SubcommandInfo } from "./reflect.ts";

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
 * @param subcommandClasses An array of subcommand class constructors.
 */
export function Subcommand(
  // deno-lint-ignore no-explicit-any
  subcommandClasses: (new () => any)[],
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const key = String(propertyKey);

    // For each provided class, create a SubcommandInfo object and add it to the parent's metadata.
    for (const cls of subcommandClasses) {
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
