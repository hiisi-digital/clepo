// loru/packages/clepo/help.ts

import type { Command } from "./command.ts";

/**
 * Generates formatted help text for a command.
 *
 * NOTE: This is a basic implementation for the current phase. A more
 * sophisticated, clap-aligned help generator will be implemented in Phase 3.
 */
export class HelpGenerator {
  constructor(private command: Command) {}

  /**
   * Generates the complete help message string.
   */
  public generate(): string {
    const cmd = this.command;
    let help = "";

    // Header (Name, Version, About)
    help += `${cmd.name}${cmd.version ? ` ${cmd.version}` : ""}\n`;
    if (cmd.about) {
      help += `${cmd.about}\n`;
    }

    // Usage
    help += "\nUSAGE:\n";
    help += `    ${cmd.name}`;
    if (cmd.args.size > 0) {
      help += " [OPTIONS]";
    }
    if (cmd.subcommands.size > 0) {
      help += " <SUBCOMMAND>";
    }

    // Options
    if (cmd.args.size > 0) {
      help += "\n\nOPTIONS:\n";
      const options = new Map<string, string>();
      for (const arg of cmd.args.values()) {
        if (arg.long || arg.short) {
          const flag = arg.long
            ? `--${arg.long}`
            : (arg.short ? `-${arg.short}` : "");
          if (flag) {
            options.set(flag.padEnd(20), arg.help ?? "");
          }
        }
      }
      // Add default help option
      options.set("-h, --help".padEnd(20), "Print help information");

      for (const [key, value] of options.entries()) {
        help += `    ${key}${value}\n`;
      }
    }

    // Subcommands
    if (cmd.subcommands.size > 0) {
      help += "\n\nSUBCOMMANDS:\n";
      // Use a Set to list each subcommand only once (in case of aliases)
      const uniqueSubcommands = new Set(cmd.subcommands.values());
      for (const sub of uniqueSubcommands) {
        help += `    ${sub.name.padEnd(20)}${sub.about ?? ""}\n`;
      }
    }

    return help;
  }
}
