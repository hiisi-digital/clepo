# `clepo`

<div align="center" style="text-align: center;">

[![GitHub Stars](https://img.shields.io/github/stars/hiisi-digital/clepo.svg)](https://github.com/hiisi-digital/clepo/stargazers)
[![JSR Version](https://img.shields.io/jsr/v/@loru/clepo)](https://jsr.io/@loru/clepo)
[![GitHub Issues](https://img.shields.io/github/issues/hiisi-digital/clepo.svg)](https://github.com/hiisi-digital/clepo/issues)
![License](https://img.shields.io/github/license/hiisi-digital/clepo?color=%23009689)

> A clap-inspired CLI framework for Deno with decorator and builder APIs.

</div>

## Usage

This library provides two ways to define command-line interfaces: decorators for
the common case, and a builder API for when you need more control at runtime.

```typescript
import { Arg, ArgAction, Cli, Command, Subcommands } from "@loru/clepo";

// A subcommand - handles the 'add' action
@Command({ about: "Add files to staging" })
class AddCmd {
  // No short/long means positional. Append collects multiple values.
  @Arg({ required: true, action: ArgAction.Append })
  files!: string[];

  // `long: true` auto-generates '--force' from the property name
  @Arg({ short: "f", long: true, help: "Force add ignored files" })
  force: boolean = false;

  async run() {
    console.log(`Adding: ${this.files.join(", ")}`);
    if (this.force) console.log("(force mode)");
  }
}

// Create a subcommand "enum" - just like Rust's #[derive(Subcommand)] enum!
const Commands = Subcommands(AddCmd);

// The root command
@Command({
  name: "git",
  version: "0.1.0",
  about: "A simplified git-like CLI",
})
class GitCli {
  // Global flags propagate to subcommands. Count increments per occurrence.
  @Arg({ short: "v", long: true, action: ArgAction.Count, global: true })
  verbose = 0;

  // The subcommand - type is automatically inferred as AddCmd!
  command = Commands;

  async run() {
    if (this.verbose > 0) console.log(`Verbosity: ${this.verbose}`);
  }
}

if (import.meta.main) {
  await Cli.run(GitCli);
}
```

```bash
$ deno run cli.ts -vv add file1.txt file2.txt --force
Verbosity: 2
Adding: file1.txt, file2.txt
(force mode)
```

The builder API does the same thing, just without decorators:

```typescript
import { ArgAction, ArgBuilder, CommandBuilder } from "@loru/clepo";

class GreetInstance {
  name?: string;
  count = 1;

  async run() {
    for (let i = 0; i < this.count; i++) {
      console.log(`Hello, ${this.name}!`);
    }
  }
}

const cmd = new CommandBuilder("greet")
  .setVersion("1.0.0")
  .setAbout("A friendly greeter")
  .addArg(
    new ArgBuilder({
      id: "name", // maps to property on instance
      short: "n",
      long: "name",
      help: "Name to greet",
      required: true,
    }),
  )
  .addArg(
    new ArgBuilder({
      id: "count",
      short: "c",
      long: "count",
      help: "Number of greetings",
      default: 1,
      valueParser: "number", // built-in parser
    }),
  );

cmd.cls = GreetInstance;

if (import.meta.main) {
  await cmd.run();
}
```

## The Concept

The idea is to port `clap`'s patterns to TypeScript. Same recursive descent
parsing, same phase separation (build → finalize → parse → validate → hydrate),
same terminology where it makes sense.

Type inference works from TypeScript annotations when `emitDecoratorMetadata` is
enabled. For future TC39 decorator compatibility, there's also an explicit `type`
option that doesn't rely on reflection.

The library includes comprehensive integration tests covering all major features.

## Features

| Feature              | Notes                                                                       |
| :------------------- | :-------------------------------------------------------------------------- |
| Subcommands          | Nested command hierarchies with `Subcommands()` or `@Subcommand`            |
| Global flags         | Propagate to all subcommands with `global: true`                            |
| Positional args      | No short/long = positional                                                  |
| Type inference       | From TS annotations or explicit `type` option                               |
| Value parsers        | Built-in `number`, `boolish`, `{ ranged: [min, max] }`, or custom functions |
| Environment fallback | `env: "VAR_NAME"` falls back to env var                                     |
| Possible values      | Restrict to a set of allowed strings                                        |
| Conflicts            | `conflictsWith: ["other"]` for mutual exclusivity                           |
| Hidden args          | `hide: true` to exclude from help                                           |
| Typo suggestions     | "Did you mean...?" via Levenshtein distance                                 |
| Structured errors    | `ClepoError` with `ErrorKind` enum                                          |
| Auto help/version    | `-h/--help` and `-V/--version` injected automatically                       |

### Argument Actions

| Action     | What it does               | Default for        |
| :--------- | :------------------------- | :----------------- |
| `Set`      | Store value (last wins)    | `string`, `number` |
| `Append`   | Collect into array         | `string[]`         |
| `SetTrue`  | Store `true` when present  | `boolean`          |
| `SetFalse` | Store `false` when present | -                  |
| `Count`    | Increment per occurrence   | -                  |
| `Help`     | Show help, exit            | auto-injected      |
| `Version`  | Show version, exit         | auto-injected      |

### Value Parsers

```typescript
// number: rejects NaN
@Arg({ long: "port", valueParser: "number" })
port: number = 8080;

// boolish: accepts yes/no, on/off, true/false, 1/0
@Arg({ long: "debug", valueParser: "boolish" })
debug = false;

// ranged: integer within bounds (inclusive)
@Arg({ long: "threads", valueParser: { ranged: [1, 64] } })
threads = 4;

// custom function
@Arg({
  long: "date",
  valueParser: (val) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) throw new Error("Invalid date");
    return d;
  },
})
date?: Date;
```

### Type Config for TC39 Decorators

TC39 decorators don't support `emitDecoratorMetadata`, so type inference from
annotations won't work there. The `type` option is a workaround:

```typescript
// Works without reflection metadata
@Arg({ long: "count", type: "number" })
count!: number;

@Arg({ long: "items", type: "list" })
items!: string[];
```

## Subcommands API

The `Subcommands()` function provides a clap-like ergonomic API for defining
subcommand enums. It automatically infers the union type from the provided classes:

```typescript
import { Arg, Command, Subcommands } from "@loru/clepo";

@Command({ about: "Clone a repository" })
class CloneCmd {
  @Arg({ required: true })
  remote!: string;

  async run() {
    console.log(`Cloning ${this.remote}`);
  }
}

@Command({ about: "Show diff between commits" })
class DiffCmd {
  @Arg({ long: "base" })
  base?: string;

  async run() {
    console.log(`Showing diff from ${this.base ?? "HEAD"}`);
  }
}

// Create the "enum" - one line!
const Commands = Subcommands(CloneCmd, DiffCmd);

@Command({ name: "git", version: "1.0.0" })
class GitCli {
  @Arg({ short: "v", long: "verbose" })
  verbose = false;

  // Type is automatically CloneCmd | DiffCmd
  command = Commands;

  async run() {}
}
```

Compare to Rust's clap:

| Rust clap                       | TypeScript clepo                            |
| :------------------------------ | :------------------------------------------ |
| `enum Commands { Clone, Diff }` | `const Commands = Subcommands(Clone, Diff)` |
| `command: Commands`             | `command = Commands`                        |

### Alternative Patterns

You can also use the explicit `@Subcommand` decorator if preferred:

```typescript
// With Subcommands() helper
@Subcommand(Commands)
command = Commands;

// Or the original array-based API
@Subcommand([CloneCmd, DiffCmd])
command!: CloneCmd | DiffCmd;
```

## Error Handling

Clepo provides structured errors that can be programmatically handled:

```typescript
import { ClepoError, ErrorKind } from "@loru/clepo";

try {
  await Cli.run(MyCommand);
} catch (e) {
  if (e instanceof ClepoError) {
    switch (e.kind) {
      case ErrorKind.MissingRequiredArgument:
        console.error("Missing required argument:", e.message);
        break;
      case ErrorKind.InvalidArgumentValue:
        console.error("Invalid value:", e.message);
        break;
      case ErrorKind.MissingSubcommand:
        console.error("Missing subcommand:", e.message);
        break;
      default:
        console.error("Error:", e.message);
    }
  }
}
```

### Error Kinds

| Kind                      | Description                                   |
| :------------------------ | :-------------------------------------------- |
| `MissingRequiredArgument` | A required argument was not provided          |
| `UnknownArgument`         | An unrecognized argument was provided         |
| `InvalidArgumentValue`    | An argument's value could not be parsed       |
| `MissingValue`            | A flag requires a value but none was given    |
| `UnexpectedArgument`      | An argument was provided in the wrong context |
| `MissingSubcommand`       | A required subcommand was not provided        |
| `ArgumentConflict`        | Mutually exclusive arguments were used        |
| `Internal`                | A bug in clepo (please report!)               |

## Installation

```typescript
import { Arg, Cli, Command, Subcommands } from "jsr:@loru/clepo";
```

Or in `deno.json`:

```json
{
  "imports": {
    "@loru/clepo": "jsr:@loru/clepo@^0.5.0"
  }
}
```

> **Status**: Under active development. API is stabilizing but may change.

## What's Not Implemented Yet

- Shell completion generation
- Man page generation
- `num_args` (min/max value count)
- `value_delimiter` (comma-separated values)
- `trailing_var_arg` (capture remaining args)

## Support

Whether you use this project, have learned something from it, or just like it,
please consider supporting it by buying me a coffee, so I can dedicate more time
on open-source projects like this :)

<a href="https://buymeacoffee.com/orgrinrt" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>

## License

> You can check out the full license [here](https://github.com/hiisi-digital/clepo/blob/main/LICENSE)

This project is licensed under the terms of the **Mozilla Public License 2.0**.

`SPDX-License-Identifier: MPL-2.0`
