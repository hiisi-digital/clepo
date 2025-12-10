# Clepo: CLI Framework for Deno

**Clepo** (CLI Repository/Power) is a robust, type-safe CLI framework for Deno, inspired by Rusts `clap` and `structopt`. It leverages TypeScript decorators to define commands, arguments, and options in a declarative, object-oriented manner.

## Key Features

*   **Decorator-based Definition**: Define your CLI structure using `@Command`, `@Arg`, and `@Option` decorators on classes and properties.
*   **Dry-Run Safety**: Built-in support for "Dry Runs". Commands marked as `mutable` automatically respect a `--dry-run` flag, allowing you to simulate destructive actions without side effects.
*   **Dependency Injection**: Automatic injection of a `Context` object containing abstracted File System and Shell interfaces.
*   **Subcommands**: Easy nesting of commands to create complex CLI hierarchies (e.g., `app remote add origin`).
*   **Auto-Help**: Automatic generation of help messages and usage instructions.

## Installation

```typescript
import { Command, Cli } from "jsr:@clepo/core"; // Example import
// OR from relative path if inside workspace
```

## Quick Start

### 1. Define a Command

```typescript
import { Command, Option, Arg, Context } from "./mod.ts";

@Command({
  name: "greet",
  about: "Greets a user",
})
class GreetCommand {
  @Option({ short: "l", help: "Loudly greet (uppercase)" })
  loud: boolean = false;

  @Arg({ help: "The name to greet" })
  name: string = "World";

  async run(ctx: Context) {
    let message = `Hello, ${this.name}!`;
    if (this.loud) {
      message = message.toUpperCase();
    }
    ctx.log.info(message);
  }
}
```

### 2. Run the CLI

```typescript
import { Cli } from "./mod.ts";

if (import.meta.main) {
  const cli = new Cli(GreetCommand);
  await cli.run(Deno.args);
}
```

### 3. Usage

```bash
deno run -A main.ts --loud Bob
# Output: [INFO] HELLO, BOB!

deno run -A main.ts --help
# Output: Usage: greet [OPTIONS] [COMMAND] ...
```

## Advanced Usage

### Mutable Commands & Dry Runs

Clepo shines when dealing with commands that modify the system state.

```typescript
@Command({
  name: "delete",
  about: "Deletes a file",
  mutable: true, // <--- Signals that this command mutates state
})
class DeleteCommand {
  @Arg()
  path: string;

  async run(ctx: Context) {
    // ctx.fs is automatically swapped based on --dry-run
    if (await ctx.fs.exists(this.path)) {
       await ctx.fs.remove(this.path);
       ctx.log.info(`Deleted ${this.path}`);
    } else {
       ctx.log.warn("File not found");
    }
  }
}
```

**Running with `--dry-run`:**
```bash
deno run -A main.ts delete ./config.json --dry-run
# Output: 
# [DryRun] Would remove "./config.json"
# [INFO] Deleted ./config.json
```

### Subcommands

```typescript
@Command({
  name: "remote",
  subcommands: [AddRemote, RemoveRemote]
})
class RemoteCommand {
    // Acts as a namespace
}
```

## API Reference

### Decorators

*   `@Command(config)`: Class decorator.
    *   `name`: Command name.
    *   `about`: Short description.
    *   `subcommands`: Array of subcommand classes.
    *   `mutable`: Boolean. If true, implies side effects.
*   `@Option(config)`: Property decorator for flags (e.g., `--verbose`, `-v`).
*   `@Arg(config)`: Property decorator for positional arguments.

### Context

The `Context` object provided to `run()` includes:

*   `fs`: Abstracted File System (`readTextFile`, `writeTextFile`, `exists`, `remove`, `mkdir`).
*   `shell`: Abstracted Shell runner.
*   `log`: Logger interface.
*   `env`: Environment variables.
*   `dryRun`: Boolean indicating if dry-run mode is active.

## License

MPL-2.0
