import { type ArgConfig, type CommandConfig, type CommandMetadata } from "./types.ts";

const REGISTRY = new Map<any, CommandMetadata>();

export function getCommandMetadata(target: any): CommandMetadata {
  let meta = REGISTRY.get(target);
  if (!meta) {
    meta = {
      cls: target,
      config: { name: "" },
      args: new Map(),
      subcommands: new Map(),
    };
    REGISTRY.set(target, meta);
  }
  return meta;
}

function handleSubcommands(config: CommandConfig, meta: CommandMetadata) {
    if (config.subcommands) {
      for (const sub of config.subcommands) {
        const subMeta = getCommandMetadata(sub);
        subMeta.parent = meta;
        meta.subcommands.set(subMeta.config.name, subMeta);
        
        if (subMeta.config.aliases) {
            for(const alias of subMeta.config.aliases) {
                meta.subcommands.set(alias, subMeta);
            }
        }
      }
    }
}

export function Command(config: CommandConfig) {
  return function (target: any, context?: any) {
    // Standard Decorator check
    if (context && typeof context === "object" && context.kind === "class") {
        const meta = getCommandMetadata(target);
        meta.config = { ...meta.config, ...config };
        
        // Pull args from metadata if any
        if (context.metadata && (context.metadata as any).loruArgs) {
             const args = (context.metadata as any).loruArgs as Map<string, ArgConfig>;
             for(const [k, v] of args) {
                 meta.args.set(k, v);
             }
        }
        handleSubcommands(config, meta);
        return;
    }

    // Legacy
    const meta = getCommandMetadata(target);
    meta.config = { ...meta.config, ...config };
    handleSubcommands(config, meta);
  };
}

export function Option(config: ArgConfig = {}) {
  return function (target: any, propertyKeyOrContext: any) {
    // Standard: target is undefined for fields
    if (typeof target === "undefined" && typeof propertyKeyOrContext === "object" && propertyKeyOrContext.kind === "field") {
        const context = propertyKeyOrContext;
        const name = String(context.name);
        
        // Ensure metadata object exists 
        try {
            if (!context.metadata) {
                 // Deno should provide this, but if not we might be in trouble without polyfill
                 // We can try to shim it locally if needed, but cant assign to readonly context.metadata usually
            }
        } catch(e) {}

        const metaObj = context.metadata || {}; 
        const args = (metaObj.loruArgs || ((metaObj as any).loruArgs = new Map()));
        
        if (!config.name) config.name = name;
        if (!config.long && !config.short) config.long = config.name;
        
        args.set(name, config);
        return;
    }

    // Legacy
    const constructor = target.constructor;
    const meta = getCommandMetadata(constructor);
    const propertyKey = propertyKeyOrContext;
    
    if (!config.name) {
      config.name = String(propertyKey);
    }
    if (!config.long && !config.short) {
        config.long = config.name;
    }

    meta.args.set(propertyKey, config);
  };
}

export function Arg(config: ArgConfig = {}) {
    return function (target: any, propertyKeyOrContext: any) {
        if (typeof target === "undefined" && typeof propertyKeyOrContext === "object" && propertyKeyOrContext.kind === "field") {
             const context = propertyKeyOrContext;
             const name = String(context.name);
             
             const metaObj = context.metadata || {}; 
             const args = (metaObj.loruArgs || ((metaObj as any).loruArgs = new Map()));
             
             if (!config.name) config.name = name;
             args.set(name, { ...config, short: undefined, long: undefined });
             return;
        }

        // Legacy
        const constructor = target.constructor;
        const meta = getCommandMetadata(constructor);
        const propertyKey = propertyKeyOrContext;
        
        if (!config.name) {
            config.name = String(propertyKey);
        }
        
        meta.args.set(propertyKey, { ...config, short: undefined, long: undefined });
    }
}
