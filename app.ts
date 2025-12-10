import { parse } from "std/flags/mod.ts";
import {
  ConsoleLogger,
  type Context,
  DryRunFS,
  DryRunShell,
  RealFS,
  RealShell,
} from "./context.ts";
import { getCommandMetadata } from "./decorators.ts";
import { type CommandMetadata } from "./types.ts";

export class Cli {
  private root: CommandMetadata;

  // deno-lint-ignore no-explicit-any
  constructor(rootCommand: new () => any) {
    this.root = getCommandMetadata(rootCommand);
  }

  async run(args: string[]): Promise<void> {
    // 1. Initial parse to find global flags like --dry-run
    // We might want to parse strictly later, but for now we just look for flags
    const parsed = parse(args, {
      boolean: ["dry-run", "help"],
      alias: { h: "help" },
    });

    const isDryRun = !!parsed["dry-run"];

    // 2. Setup Context
    const logger = new ConsoleLogger();
    const ctx: Context = {
      log: logger,
      env: Deno.env.toObject(),
      cwd: Deno.cwd(),
      dryRun: isDryRun,
      fs: isDryRun ? new DryRunFS(logger) : new RealFS(),
      shell: isDryRun ? new DryRunShell(logger) : new RealShell(),
      helper: {
        confirm: (msg) => Promise.resolve(confirm(msg)),
        prompt: (msg, def) => Promise.resolve(prompt(msg, def) || def || ""),
      },
    };

    // 3. Resolve Command
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

    // 4. Show Help if requested
    if (parsed.help) {
      this.printHelp(current);
      return;
    }

    // 5. Instantiate and Populate Command
    const cmdInstance = new current.cls();

    // Populate flags/options
    for (const [propKey, config] of current.args) {
      // deno-lint-ignore no-explicit-any
      let value: any = undefined;

      // Handle Flags (Options)
      if (config.long || config.short) {
        // Determine value from parsed args
        // Priority: --long, -s, default
        if (config.long && parsed[config.long] !== undefined) {
          value = parsed[config.long];
        } else if (config.short && parsed[config.short] !== undefined) {
          value = parsed[config.short];
        } else {
          value = config.default;
        }
      } // Handle Positionals
      else {
        // If it's a positional argument, we take from remaining positionalArgs
        // Note: strict positional mapping needs index logic.
        // For now, we take the next available positional if we haven't consumed all.
        // This is a naive implementation.
        if (argIndex < positionalArgs.length) {
          value = positionalArgs[argIndex];
          argIndex++; // Consume
        } else {
          value = config.default;
        }
      }

      // Type conversion (basic)
      if (value !== undefined) {
        if (config.type === "number") value = Number(value);
        if (config.type === "boolean") value = Boolean(value);

        // Inject into instance
        // deno-lint-ignore no-explicit-any
        (cmdInstance as any)[propKey] = value;
      }

      // Check required
      if (config.required && value === undefined) {
        console.error(`Error: Missing required argument: ${config.name}`);
        Deno.exit(1);
      }
    }

    // 6. Mutable Check
    if (current.config.mutable && !isDryRun) {
      // Implicit check? Or maybe we rely on the context.
      // If the command is mutable but we didn't pass dry-run, we execute normally.
      // If we did pass dry-run, we execute with dry-run context.
      // But maybe we want to WARN if it is mutable?
      // "Running in Mutable Mode"
    }

    // 7. Run
    try {
      if (typeof cmdInstance.run === "function") {
        await cmdInstance.run(ctx);
      } else {
        // If no run method, maybe show help?
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
      // Deduplicate aliases
      const seen = new Set<CommandMetadata>();
      for (const sub of meta.subcommands.values()) {
        if (seen.has(sub)) continue;
        seen.add(sub);
        console.log(
          `  ${sub.config.name.padEnd(12)} ${sub.config.about || ""}`,
        );
      }
      console.log("");
    }

    if (meta.args.size > 0) {
      console.log("Arguments:");
      for (const [, config] of meta.args) {
        let flags = "";
        if (config.short) flags += `-${config.short}`;
        if (config.long) flags += (flags ? ", " : "") + `--${config.long}`;
        if (!config.short && !config.long) {
          flags = `[${config.name?.toUpperCase()}]`;
        }

        console.log(`  ${flags.padEnd(15)} ${config.help || ""}`);
      }
      console.log("");
    }
  }
}
