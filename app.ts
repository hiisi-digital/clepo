import {
  ConsoleLogger,
  type Context,
  DryRunFS,
  DryRunShell,
  RealFS,
  RealShell,
} from "./context.ts";
import { getCommandMetadata } from "./decorators.ts";
import { HelpGenerator } from "./help.ts";
import { Parser, ParserError } from "./parser.ts";
import type { CommandMetadata } from "./types.ts";

/**
 * The main entry point for a clepo-based command-line application.
 * This class orchestrates the parsing, context creation, and execution of commands.
 */
export class Cli {
  private root: CommandMetadata;

  /**
   * Creates a new CLI application instance.
   * @param rootCommand The root command class, decorated with `@Command`.
   */
  // deno-lint-ignore no-explicit-any
  constructor(rootCommand: new () => any) {
    this.root = getCommandMetadata(rootCommand);
  }

  /**
   * Parses the command-line arguments and executes the matched command.
   * @param args The command-line arguments, typically from `Deno.args`.
   */
  async run(args: string[]): Promise<void> {
    const logger = new ConsoleLogger();

    // 1. Setup Context
    // We scan for --dry-run manually for context setup before full parsing.
    // This allows the Context to be configured correctly even if parsing fails later,
    // though arguably dry-run should be part of the parsed flags.
    // For v0.2, strictly checking the raw args array is sufficient.
    const isDryRun = args.includes("--dry-run");

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

    try {
      const parser = new Parser(this.root);
      const { instance, meta, helpRequested, versionRequested } = parser.parse(
        args,
        ctx.env,
      );

      if (helpRequested) {
        this.printHelp(meta);
        return;
      }

      if (versionRequested) {
        // Look for version in current command or root
        const version = meta.config.version || this.root.config.version ||
          "0.0.0";
        console.log(`${meta.config.name} ${version}`);
        return;
      }

      // Execute
      if (typeof instance.run === "function") {
        await instance.run(ctx);
      } else {
        // If no run method, and it has subcommands, show help
        if (meta.subcommands.size > 0) {
          this.printHelp(meta);
        } else {
          logger.warn(`Command '${meta.config.name}' has no run method.`);
        }
      }
    } catch (e) {
      if (e instanceof ParserError) {
        logger.error(e.message);
        console.log(`\nFor more information, try '--help'.`);
        Deno.exit(1);
      } else {
        throw e;
      }
    }
  }

  private printHelp(meta: CommandMetadata) {
    const helpText = new HelpGenerator(meta).generate();
    console.log(helpText);
  }
}
