import type { Arg, CommandMetadata } from "./types.ts";

/**
 * Generates formatted help text for a command.
 */
export class HelpGenerator {
  constructor(private meta: CommandMetadata) {}

  /**
   * Generates the complete help message.
   */
  public generate(): string {
    const parts: string[] = [];

    parts.push(this.generateHeader());
    parts.push(this.generateUsage());
    parts.push(this.generateDescription());
    parts.push(this.generateArguments());
    parts.push(this.generateOptions());
    parts.push(this.generateCommands());
    parts.push(this.generateFooter());

    return parts.filter((p) => p).join("\n\n");
  }

  private generateHeader(): string {
    const { name, version, about } = this.meta.config;
    let header = `${name || "command"}`;
    if (version) {
      header += ` ${version}`;
    }
    if (about) {
      header += `\n${about}`;
    }
    return header;
  }

  private generateUsage(): string {
    const { name } = this.meta.config;
    const displayName = name || "command";

    // Build a more intelligent usage string
    let usage = `USAGE:\n  ${displayName}`;

    const hasOptions = this.meta.args.size > 0;
    const hasSubcommands = this.meta.subcommands.size > 0;
    const positionals = [...this.meta.args.values()].filter((a) =>
      !a.short && !a.long
    );

    if (hasOptions) {
      usage += ` [OPTIONS]`;
    }

    for (const pos of positionals) {
      const required = pos.required ?? false;
      usage += required ? ` <${pos.id}>` : ` [${pos.id}]`;
    }

    if (hasSubcommands) {
      usage += ` [COMMAND]`;
    }

    return usage;
  }

  private generateDescription(): string {
    return this.meta.config.longAbout || "";
  }

  private generateSection(title: string, items: [string, string][]): string {
    if (items.length === 0) return "";

    const pad = items.reduce((max, [left]) => Math.max(max, left.length), 0) +
      2;

    const lines = items.map(([left, right]) => `  ${left.padEnd(pad)}${right}`);
    return `${title}:\n${lines.join("\n")}`;
  }

  private generateArguments(): string {
    const positionals = [...this.meta.args.values()]
      .filter((arg) => !arg.short && !arg.long);

    const items = positionals.map((arg) => {
      const displayName = `<${arg.id || "arg"}>`;
      return [displayName, this.getArgHelp(arg)] as [string, string];
    });

    return this.generateSection("ARGUMENTS", items);
  }

  private generateOptions(): string {
    const options = [...this.meta.args.values()]
      .filter((arg) => arg.short || arg.long);

    const items = options.map((arg) => {
      let flags = "";
      if (arg.short) flags += `-${arg.short}`;
      if (arg.long) {
        if (flags) flags += ", ";
        flags += `--${arg.long}`;
      }
      if (this.argTakesValue(arg)) {
        flags += ` <${arg.id || "value"}>`;
      }
      return [flags, this.getArgHelp(arg)] as [string, string];
    });

    // Add default help/version if not present
    const hasHelp = options.some((o) => o.long === "help" || o.short === "h");
    const hasVersion = options.some((o) =>
      o.long === "version" || o.short === "V"
    );

    if (!hasHelp) {
      items.push(["  -h, --help", "Print help"]);
    }
    if (!hasVersion && this.meta.config.version) {
      items.push(["  -V, --version", "Print version"]);
    }

    return this.generateSection("OPTIONS", items);
  }

  private generateCommands(): string {
    if (this.meta.subcommands.size === 0) return "";

    const seen = new Set<CommandMetadata>();
    const items: [string, string][] = [];

    for (const sub of this.meta.subcommands.values()) {
      if (seen.has(sub)) continue;
      seen.add(sub);

      let name = sub.config.name || sub.cls.name.toLowerCase();
      if (sub.config.aliases && sub.config.aliases.length > 0) {
        name += ` (${sub.config.aliases.join(", ")})`;
      }

      items.push([name, sub.config.about || ""]);
    }

    return this.generateSection("COMMANDS", items);
  }

  private generateFooter(): string {
    // Could be used for examples in the future
    return "";
  }

  private getArgHelp(arg: Arg): string {
    let help = arg.help || "";
    const details: string[] = [];
    if (arg.default !== undefined) {
      details.push(`default: ${arg.default}`);
    }
    if (arg.env) {
      details.push(`env: ${arg.env}`);
    }
    if (arg.possibleValues) {
      details.push(`possible values: ${arg.possibleValues.join(", ")}`);
    }

    if (details.length > 0) {
      help += ` [${details.join(", ")}]`;
    }
    return help;
  }

  private argTakesValue(arg: Arg): boolean {
    if (arg.type === "boolean") return false;
    // Count is a flag that doesn't take a value
    if (arg.action === "count") return false;
    return true;
  }
}
