# `clepo`

<div align="center" style="text-align: center;">

[![GitHub Stars](https://img.shields.io/github/stars/hiisi-digital/clepo.svg)](https://github.com/hiisi-digital/clepo/stargazers)
[![JSR Version](https://img.shields.io/jsr/v/@clepo/core)](https://jsr.io/@clepo/core)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/clepo.svg)](https://github.com/hiisi-digital/clepo/issues)
![License](https://img.shields.io/github/license/hiisi-digital/clepo?color=%23009689)

> A robust CLI framework for Deno that enforces safe dry-runs via dependency
> injection.

</div>

## Usage

The `clepo` package provides a decorator-based interface for building
command-line tools. It maps arguments to class properties and injects a context
object for handling side effects safely.

```typescript
import { Arg, Cli, Command, Context, Option } from "jsr:@clepo/core";

@Command({
  name: "rm",
  about: "Remove a file",
  mutable: true, // Enforces safety checks
})
class RemoveCmd {
  @Option({ short: "f", help: "Force removal" })
  force: boolean = false;

  @Arg()
  path: string;

  async run(ctx: Context) {
    // ctx.fs automatically handles dry-run logic
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

- **Decorator-based Definition**: declarative mapping of CLI arguments to class
  properties
- **Dry-Run Safety**: built-in `mutable` flag enforces `dry-run` checks
- **Dependency Injection**: abstracts filesystem and shell operations
  - _Real Mode_: performs actual I/O operations
  - _Dry Mode_: logs intended operations without side effects
- **Subcommands**: supports nested command structures via recursion
- **Auto-Help**: generates usage instructions from metadata

## The problem

Most CLI tools lack a standardized way to handle "Dry Runs" or "Safety Checks".
Implementing a `--dry-run` flag often leads to conditional logic scattered
throughout the codebase (`if (!dryRun) ...`), which is prone to human error and
makes the code harder to read.

`clepo` solves this by abstracting the side effects into a `Context` object. The
framework decides which implementation of the context (Real vs Dry) to inject
based on the presence of the `--dry-run` flag. If a command is marked as
`mutable`, the framework ensures that the safety guarantees are met.

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
