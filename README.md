# `clepo`

<div align="center" style="text-align: center;">

[![GitHub Stars](https://img.shields.io/github/stars/hiisi-digital/clepo.svg)](https://github.com/hiisi-digital/clepo/stargazers)
[![JSR Version](https://img.shields.io/jsr/v/@clepo/core)](https://jsr.io/@clepo/core)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/clepo.svg)](https://github.com/hiisi-digital/clepo/issues)
![License](https://img.shields.io/github/license/hiisi-digital/clepo?color=%23009689)

> A clap-inspired CLI framework for Deno focusing on ergonomics and declarative
> command definition.

</div>

> **⚠️ Work in Progress**: This library is currently under active development
> and the API is subject to change. Use with caution.

## Usage

The `clepo` package provides a decorator-based interface for building
command-line tools, closely mirroring the Rust `clap` derive API.

```typescript
import { Arg, Cli, Context, Command } from "jsr:@clepo/core";

@Command({
  name: "rm",
  about: "Remove a file",
  version: "1.0.0",
})
class RemoveCmd {
  @Arg({ short: "f", long: true, help: "Force removal" })
  force: boolean = false;

  // Arguments without short/long flags are positional by default
  @Arg({ help: "File to remove", required: true })
  path!: string;

  async run(ctx: Context) {
    // ctx.fs automatically handles dry-run logic when --dry-run is passed
    if (this.force || await ctx.helper.confirm(`Delete ${this.path}?`)) {
      await ctx.fs.remove(this.path);
      ctx.log.info(`Deleted ${this.path}`);
    }
  }
}

if (import.meta.main) {
  await new Cli(RemoveCmd).run(Deno.args);
}
```

## Features

- **Declarative API**: Define commands, arguments, and options using TypeScript
  decorators (`@Command`, `@Arg`).
- **Command Hierarchy**: Support for nested subcommands via `@Subcommand` to
  create structured CLIs.
- **Context Injection**: Abstracts system interactions (filesystem, shell) for
  testing and safety.
- **Automatic Help**: Generates usage information and help text from command
  metadata.
- **Dry-Run Support**: Built-in `DryRunFS` and `DryRunShell` implementations
  when `--dry-run` is detected.

## The problem

Building CLI tools often involves significant boilerplate code for argument
parsing, validation, and help text generation. Without a structured framework,
tools can become inconsistent in behavior and difficult to maintain.

Additionally, implementing robust safety mechanisms like "dry runs" is often an
afterthought, leading to scattered conditional logic (`if (!dryRun) ...`) that
is prone to errors.

`clepo` aims to address these issues by providing a consistent, ergonomic API
inspired by Rust's `clap`. It allows developers to define the CLI interface
declaratively, ensuring consistency and reducing boilerplate, while also
offering built-in patterns for handling side effects.

## Support

Whether you use this project, have learned something from it, or just like it,
please consider supporting it by buying me a coffee, so I can dedicate more time
on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> The project is licensed under the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`

> You can check out the full license
> [here](https://github.com/hiisi-digital/clepo/blob/main/LICENSE)
