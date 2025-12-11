// loru/packages/clepo/reflect.ts

import "reflect-metadata";
import type { Arg } from "./arg.ts";
import type { CommandConfig } from "./command.ts";

/**
 * Represents the type information retrieved via reflection.
 */
export interface ReflectType {
  /** The name of the constructor, e.g., "String", "Number", "Boolean", "Array". */
  name: string;
}

/**
 * Stores metadata about a subcommand's relationship to its parent.
 */
export interface SubcommandInfo {
  /** The property on the parent class where the subcommand instance should be injected. */
  property: string;
  /** The class constructor of the subcommand. */
  // deno-lint-ignore no-explicit-any
  class: new () => any;
}

// Use unique symbols for metadata keys to avoid collisions with other libraries.
const commandMetadataKey = Symbol("clepo:command");
const argsMetadataKey = Symbol("clepo:args");
const subcommandsMetadataKey = Symbol("clepo:subcommands");

/**
 * Normalizes a target to its constructor function.
 *
 * When decorators are applied to class properties, the `target` is the class prototype.
 * When we retrieve metadata in `getCommand`, we pass the class constructor.
 * This function ensures we always work with the constructor for consistent metadata storage.
 *
 * @param target Either a class constructor or a class prototype.
 * @returns The class constructor.
 */
function toConstructor(target: object): object {
  // If target is a function, it's already a constructor.
  if (typeof target === "function") {
    return target;
  }
  // Otherwise, it's a prototype, so we get its constructor.
  if (target.constructor && typeof target.constructor === "function") {
    return target.constructor;
  }
  // Fallback (shouldn't happen in normal use).
  return target;
}

/**
 * A singleton object that provides a clean API for setting and getting decorator metadata.
 * It uses the `Reflect.metadata` API, which is the standard for decorator-based libraries.
 *
 * All methods normalize their targets to the constructor to ensure consistent storage
 * regardless of whether a prototype or constructor is passed.
 */
export const reflect = {
  // --- Command Metadata ---

  /**
   * Attaches command configuration metadata to a class constructor.
   * @param target The class constructor (or prototype - will be normalized).
   * @param config The command configuration object.
   */
  setCommand(target: object, config: CommandConfig): void {
    const ctor = toConstructor(target);
    Reflect.defineMetadata(commandMetadataKey, config, ctor);
  },

  /**
   * Retrieves command configuration metadata from a class.
   * @param target The class constructor (or prototype - will be normalized).
   * @returns The command configuration object, or `undefined` if not found.
   */
  getCommand(target: object): CommandConfig | undefined {
    const ctor = toConstructor(target);
    return Reflect.getMetadata(commandMetadataKey, ctor) as
      | CommandConfig
      | undefined;
  },

  // --- Argument Metadata ---

  /**
   * Adds argument configuration to a class's metadata.
   * Since a class can have multiple arguments, they are stored in an array.
   * @param target The class prototype (or constructor - will be normalized).
   * @param config The argument configuration object.
   */
  addArg(target: object, config: Arg): void {
    const ctor = toConstructor(target);

    // Get existing args from the constructor
    const args = this.getArgs(ctor);
    const existing = args.find((a) => a.id === config.id);

    if (existing) {
      // Merge properties, allowing later definitions to override.
      Object.assign(existing, config);
    } else {
      args.push(config);
    }

    Reflect.defineMetadata(argsMetadataKey, args, ctor);
  },

  /**
   * Retrieves all argument configurations for a class.
   * @param target The class constructor (or prototype - will be normalized).
   * @returns An array of argument configurations.
   */
  getArgs(target: object): Arg[] {
    const ctor = toConstructor(target);
    return (Reflect.getMetadata(argsMetadataKey, ctor) as Arg[] | undefined) ??
      [];
  },

  // --- Subcommand Metadata ---

  /**
   * Adds subcommand relationship information to a class's metadata.
   * @param target The class prototype (or constructor - will be normalized).
   * @param info The subcommand information.
   */
  addSubcommand(target: object, info: SubcommandInfo): void {
    const ctor = toConstructor(target);
    const subcommands = this.getSubcommands(ctor);
    subcommands.push(info);
    Reflect.defineMetadata(subcommandsMetadataKey, subcommands, ctor);
  },

  /**
   * Retrieves all subcommand configurations for a class.
   * @param target The class constructor (or prototype - will be normalized).
   * @returns An array of subcommand information objects.
   */
  getSubcommands(target: object): SubcommandInfo[] {
    const ctor = toConstructor(target);
    return (Reflect.getMetadata(subcommandsMetadataKey, ctor) as
      | SubcommandInfo[]
      | undefined) ?? [];
  },

  // --- Type Reflection ---

  /**
   * Retrieves the design-time type of a property using reflection.
   * This is crucial for inferring argument actions and types.
   *
   * NOTE: This requires the `emitDecoratorMetadata` compiler option to be enabled.
   *
   * @param target The class prototype (not the constructor, as design:type is stored on prototype).
   * @param propertyKey The name of the property.
   * @returns A `ReflectType` object, or `undefined` if the type is not found.
   */
  getType(target: object, propertyKey: string): ReflectType | undefined {
    // `design:type` is a special metadata key populated by TypeScript.
    // Unlike our custom metadata, design:type is stored on the prototype, not the constructor.
    // So we need the prototype here, not the constructor.
    const typeConstructor = Reflect.getMetadata(
      "design:type",
      target,
      propertyKey,
    ) as (new (...args: unknown[]) => unknown) | undefined;

    if (typeConstructor && typeof typeConstructor.name === "string") {
      return { name: typeConstructor.name };
    }

    return undefined;
  },
};
