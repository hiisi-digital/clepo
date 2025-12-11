// loru/packages/clepo/help.ts

import { bold, gray, green, italic, yellow } from "@std/fmt/colors";
import { type Arg, ArgAction } from "./arg.ts";
import type { Command } from "./command.ts";

/**
 * Defines the color scheme for the help output.
 */
interface HelpTheme {
  heading: (s: string) => string;
  literal: (s: string) => string;
  placeholder: (s: string) => string;
  description: (s: string) => string;
  defaultValue: (s: string) => string;
}

/**
 * The default color theme, inspired by `clap`.
 */
const defaultTheme: HelpTheme = {
  heading: (s) => bold(yellow(s)),
  literal: (s) => bold(green(s)),
  placeholder: (s) => green(s),
  description: (s) => s,
  defaultValue: (s) => gray(italic(s)),
};

const INDENT = "  ";
const PADDING = 2;

/**
 * Generates clap-style, formatted, and colored help text for a command.
 */
export class HelpGenerator {
  private theme = defaultTheme;

  constructor(private command: Command) {}

  /**
   * Generates the complete help message string.
   */
  public generate(): string {
    const parts: string[] = [];

    parts.push(this.generateHeader());
    parts.push(this.generateUsage());

    if (this.command.longAbout) {
      parts.push(`\n${this.command.longAbout}`);
    }

    const { positionals, options } = this.getArgs();

    if (positionals.length > 0) {
      parts.push(this.generateArgsSection("Arguments", positionals));
    }

    if (options.length > 0) {
      parts.push(this.generateArgsSection("Options", options));
    }

    if (this.command.subcommands.size > 0) {
      parts.push(this.generateSubcommandsSection());
    }

    return parts.join("\n");
  }

  private generateHeader(): string {
    const name = this.theme.literal(this.command.name);
    const version = this.command.version ? ` ${this.command.version}` : "";
    const about = this.command.about ? `\n${this.command.about}` : "";
    return `${name}${version}${about}`;
  }

  private generateUsage(): string {
    const cmd = this.command;
    const { positionals, options } = this.getArgs();
    const parts: string[] = [
      this.theme.heading("Usage:"),
      this.theme.literal(cmd.name),
    ];

    // Filter out help/version from the options count for usage display
    const userOptions = options.filter(
      (a) => a.action !== ArgAction.Help && a.action !== ArgAction.Version,
    );

    if (userOptions.length > 0) {
      parts.push(this.theme.placeholder("[OPTIONS]"));
    }

    if (cmd.subcommands.size > 0) {
      parts.push(this.theme.placeholder("<COMMAND>"));
    }

    for (const arg of positionals) {
      const name = arg.valueName ?? arg.id!;
      const placeholder = arg.required ? `<${name}>` : `[${name}]`;
      parts.push(this.theme.placeholder(placeholder));
    }

    return `\n${parts.join(" ")}`;
  }

  private generateArgsSection(title: string, args: Arg[]): string {
    if (args.length === 0) return "";

    const specs: [string, string][] = [];

    for (const arg of args) {
      specs.push([this.formatArgSpec(arg), this.formatArgHelp(arg)]);
    }

    const maxWidth = Math.max(...specs.map(([spec]) => spec.length));
    const lines = specs.map(([spec, help]) => {
      const paddedSpec = spec.padEnd(maxWidth + PADDING);
      return `${INDENT}${paddedSpec}${help}`;
    });

    return `\n${this.theme.heading(title)}:\n${lines.join("\n")}`;
  }

  private formatArgSpec(arg: Arg): string {
    if (!arg.short && !arg.long) {
      // Positional
      const name = arg.valueName ?? arg.id!;
      return this.theme.placeholder(`<${name}>`);
    }

    const parts: string[] = [];
    if (arg.short) parts.push(`-${arg.short}`);
    if (arg.long) parts.push(`--${arg.long}`);
    const flags = this.theme.literal(parts.join(", "));

    // The placeholder for the value, e.g., <FILE>
    const value = arg.takesValue()
      ? ` ${this.theme.placeholder(`<${arg.valueName ?? arg.id!}>`)}`
      : "";

    return `${flags}${value}`;
  }

  private formatArgHelp(arg: Arg): string {
    let help = arg.help ? this.theme.description(arg.help) : "";
    if (arg.env) {
      help += ` ${this.theme.defaultValue(`[env: ${arg.env}]`)}`;
    }
    if (arg.default !== undefined) {
      const val = typeof arg.default === "string" ? `"${arg.default}"` : String(arg.default);
      help += ` ${this.theme.defaultValue(`[default: ${val}]`)}`;
    }
    return help.trim();
  }

  private generateSubcommandsSection(): string {
    const uniqueSubs = new Set(this.command.subcommands.values());
    if (uniqueSubs.size === 0) return "";

    const specs = [...uniqueSubs].map((sub) => [
      this.theme.literal(sub.name),
      this.theme.description(sub.about ?? ""),
    ]);

    const maxWidth = Math.max(...specs.map(([spec]) => spec.length));
    const lines = specs.map(([spec, help]) => {
      const paddedSpec = spec.padEnd(maxWidth + PADDING);
      return `${INDENT}${paddedSpec}${help}`;
    });

    return `\n${this.theme.heading("Commands")}:\n${lines.join("\n")}`;
  }

  private getArgs(): { positionals: Arg[]; options: Arg[] } {
    const positionals: Arg[] = [];
    const options: Arg[] = [];

    for (const arg of this.command.args.values()) {
      if (!arg.short && !arg.long) {
        positionals.push(arg);
      } else {
        options.push(arg);
      }
    }

    // Sort options: regular options first, then help, then version
    options.sort((a, b) => {
      const aIsBuiltin = a.action === ArgAction.Help || a.action === ArgAction.Version;
      const bIsBuiltin = b.action === ArgAction.Help || b.action === ArgAction.Version;

      if (aIsBuiltin && !bIsBuiltin) return 1;
      if (!aIsBuiltin && bIsBuiltin) return -1;

      // Among builtins, help comes before version
      if (a.action === ArgAction.Help && b.action === ArgAction.Version) {
        return -1;
      }
      if (a.action === ArgAction.Version && b.action === ArgAction.Help) {
        return 1;
      }

      return 0;
    });

    return { positionals, options };
  }
}
