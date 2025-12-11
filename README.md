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

### Decorator API

```typescript
import { Arg, ArgAction, Cli, CommandDecorator, Subcommand } from "@loru/clepo";

// Subcommand definition
@CommandDecorator({ about: "Remove files from the working tree" })
class RemoveCmd {
  @Arg({ short: "f", long: true, help: "Force removal" })
  force: boolean = false;

  @Arg({ short: "r", long: true, help: "Remove directories recursively" })
  recursive: boolean = false;

  // Arguments without short/long flags are positional by default
  @Arg({ help: "Files to remove", required: true, action: ArgAction.Append })
  paths!: string[];

  async run() {
    console.log(`Removing: ${this.paths.join(", ")}`);
    console.log(`Force: ${this.force}, Recursive: ${this.recursive}`);
  }
}

// Main application
@CommandDecorator({
  name: "myapp",
  version: "1.0.0",
  about: "A sample CLI application",
})
class MyApp {
  @Arg({ short: "v", long: true, action: ArgAction.Count, global: true })
  verbose = 0;

  @Subcommand([RemoveCmd])
  command!: RemoveCmd;

  async run() {
    console.log(`Verbosity level: ${this.verbose}`);
  }
}

if (import.meta.main) {
  await Cli.run(MyApp);
}
```

### Builder API

For more dynamic scenarios, you can build commands imperatively:

```typescript
import { ArgAction, ArgBuilder, Command, CommandSettings } from "@loru/clepo";

class GreetInstance {
  name?: string;
  count = 1;

  async run() {
    for (let i = 0; i < this.count; i++) {
      console.log(`Hello, ${this.name}!`);
    }
  }
}

const cmd = new Command("greet")
  .setVersion("1.0.0")
  .setAbout("A friendly greeter")
  .addArg(
    new ArgBuilder({
      id: "name",
      short: "n",
      long: "name",
      help: "Name to greet",
      required: true,
    })
  )
  .addArg(
    new ArgBuilder({
      id: "count",
      short: "c",
      long: "count",
      help: "Number of times to greet",
      default: 1,
      valueParser: "number",
    })
  );

cmd.cls = GreetInstance;

if (import.meta.main) {
  await cmd.run();
}
```

## Features

- **Declarative API**: Define commands, arguments, and options using TypeScript
  decorators (`@Command`, `@Arg`, `@Subcommand`).
- **Builder API**: Imperatively construct CLI commands for dynamic use cases.
- **Clap-aligned Architecture**: Follows Rust's `clap` patterns with recursive
  descent parsing and proper phase separation.
- **Automatic Help/Version**: Built-in `-h/--help` and `-V/--version` flags.
- **Environment Variables**: Read argument values from environment variables
  with the `env` option.
- **Value Parsing**: Built-in parsers for numbers and support for custom
  validation functions.
- **Possible Values**: Restrict arguments to a set of allowed values.
- **Global Arguments**: Propagate arguments to all subcommands with `global: true`.
- **Argument Groups**: Define mutually exclusive or required-together arguments.
- **Typed Errors**: Structured `ClepoError` with `ErrorKind` for programmatic
  error handling.

## Argument Actions

The `ArgAction` enum controls how arguments behave:

| Action     | Description                                    | Default For   |
| :--------- | :--------------------------------------------- | :------------ |
| `Set`      | Stores the value (last wins)                   | `string`      |
| `Append`   | Collects multiple values into an array         | `string[]`    |
| `SetTrue`  | Sets to `true` when flag is present            | `boolean`     |
| `SetFalse` | Sets to `false` when flag is present           | -             |
| `Count`    | Counts occurrences (e.g., `-vvv` → `3`)        | -             |
| `Help`     | Triggers help output                           | Auto-injected |
| `Version`  | Triggers version output                        | Auto-injected |

## The Problem

Building CLI tools often involves significant boilerplate code for argument
parsing, validation, and help text generation. Without a structured framework,
tools can become inconsistent in behavior and difficult to maintain.

`clepo` addresses these issues by providing a consistent, ergonomic API inspired
by Rust's `clap`. It allows developers to define the CLI interface
declaratively, ensuring consistency and reducing boilerplate.

## Installation

```typescript
import { Arg, Cli, CommandDecorator } from "jsr:@loru/clepo";
```

Or add to your `deno.json`:

```json
{
  "imports": {
    "@loru/clepo": "jsr:@loru/clepo@^0.4.0"
  }
}
```

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
