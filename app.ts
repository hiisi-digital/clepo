import { parse } from "std/flags/mod.ts";
import { 
    Context, 
    ConsoleLogger, 
    RealFS, 
    RealShell, 
    DryRunFS, 
    DryRunShell 
} from "./context.ts";
import { getCommandMetadata } from "./decorators.ts";
import { type CommandMetadata, type ArgConfig } from "./types.ts";

export class Cli {
    private root: CommandMetadata;

    constructor(rootCommand: new () => any) {
        this.root = getCommandMetadata(rootCommand);
    }

    async run(args: string[]): Promise<void> {
        const parsed = parse(args, { boolean: ["dry-run", "help"], alias: { h: "help" } });
        
        const isDryRun = !!parsed["dry-run"];
        
        const logger = new ConsoleLogger();
        const ctx: Context = {
            log: logger,
            env: Deno.env.toObject(),
            cwd: Deno.cwd(),
            dryRun: isDryRun,
            fs: isDryRun ? new DryRunFS(logger) : new RealFS(),
            shell: isDryRun ? new DryRunShell(logger) : new RealShell(),
            helper: {
                confirm: async (msg) => confirm(msg),
                prompt: async (msg, def) => prompt(msg, def) || def || "",
            }
        };

        let current = this.root;
        const positionalArgs = parsed._.map(String);
        let argIndex = 0;

        while (argIndex < positionalArgs.length) {
            const subName = positionalArgs[argIndex];
            if (current.subcommands.has(subName)) {
                current = current.subcommands.get(subName)!;
                argIndex++;
            } else {
                break;
            }
        }

        if (parsed.help) {
            this.printHelp(current);
            return;
        }

        const cmdInstance = new current.cls();
        
        for (const [propKey, config] of current.args) {
            let value: any = undefined;
            
            if (config.long || config.short) {
                if (config.long && parsed[config.long] !== undefined) {
                    value = parsed[config.long];
                } else if (config.short && parsed[config.short] !== undefined) {
                    value = parsed[config.short];
                } else {
                    value = config.default;
                }
            } 
            else {
                if (argIndex < positionalArgs.length) {
                    value = positionalArgs[argIndex];
                    argIndex++;
                } else {
                    value = config.default;
                }
            }

            if (value !== undefined) {
                if (config.type === "number") value = Number(value);
                if (config.type === "boolean") value = Boolean(value);
                
                (cmdInstance as any)[propKey] = value;
            }
            
            if (config.required && value === undefined) {
                console.error(`Error: Missing required argument: ${config.name}`);
                Deno.exit(1);
            }
        }

        if (current.config.mutable && !isDryRun) {
             // Logic for handling mutable commands without explicit dry-run could be added here
             // e.g., prompt for confirmation if configured
        }

        try {
            if (typeof cmdInstance.run === "function") {
                await cmdInstance.run(ctx);
            } else {
                this.printHelp(current);
            }
        } catch (e) {
            logger.error(String(e));
            Deno.exit(1);
        }
    }

    private printHelp(meta: CommandMetadata) {
        console.log(`\nUsage: ${meta.config.name} [OPTIONS] [COMMAND]\n`);
        if (meta.config.about) console.log(meta.config.about + "\n");
        
        if (meta.subcommands.size > 0) {
            console.log("Commands:");
            const seen = new Set<CommandMetadata>();
            for (const sub of meta.subcommands.values()) {
                if (seen.has(sub)) continue;
                seen.add(sub);
                console.log(`  ${sub.config.name.padEnd(12)} ${sub.config.about || ""}`);
            }
            console.log("");
        }
        
        if (meta.args.size > 0) {
            console.log("Arguments:");
            for (const [, config] of meta.args) {
                let flags = "";
                if (config.short) flags += `-${config.short}`;
                if (config.long) flags += (flags ? ", " : "") + `--${config.long}`;
                if (!config.short && !config.long) flags = `[${config.name.toUpperCase()}]`;
                
                console.log(`  ${flags.padEnd(15)} ${config.help || ""}`);
            }
            console.log("");
        }
    }
}
