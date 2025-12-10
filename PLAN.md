# Clepo Development Plan

**Goal**: Create the definitive TypeScript equivalent of Rust's `clap` crate.
**Philosophy**: Strict adherence to `clap`'s architecture, terminology, and
behavior where possible, adapted for TypeScript idioms.

## Feature Matrix (Post-v0.2)

| Feature                   | Clap (Rust)              | Clepo (TS)                  | Status | Notes                                                                            |
| :------------------------ | :----------------------- | :-------------------------- | :----- | :------------------------------------------------------------------------------- |
| **API Style**             | `#[derive(Parser)]`      | `@Command`                  | ✅     | Core decorator API refactored to align with `clap`'s derive model.               |
| **Subcommands**           | `#[command(subcommand)]` | `@Subcommand(...)`          | ✅     | Supported via `@Subcommand` decorator.                                           |
| **Positional Args**       | `#[arg]` (no flags)      | `@Arg`                      | ✅     | Inferred from `@Arg` decorator when `short` or `long` are absent.                |
| **Named Options**         | `#[arg(short, long)]`    | `@Arg({ short, long })`     | ✅     | Consolidated into `@Arg` decorator.                                              |
| **Global Arguments**      | `global = true`          | `global: true`              | ✅     | Supported in `@Arg` config.                                                      |
| **Aliases**               | `visible_aliases`        | `aliases: []`               | ✅     | Supported in `@Command` config for subcommands.                                  |
| **Boolean Flags**         | `action = SetTrue`       | `action: ArgAction.SetTrue` | ✅     | Inferred from `boolean` type, or can be set explicitly.                          |
| **Auto-Help**             | `-h`, `--help`           | `-h`, `--help`              | ✅     | Basic implementation complete.                                                   |
| **Version Flag**          | `-V`, `--version`        | `-V`, `--version`           | ✅     | Auto-handled by the parser.                                                      |
| **Environment Variables** | `env = "MY_VAR"`         | `env: "MY_VAR"`             | ✅     | Supported in `@Arg` config.                                                      |
| **Default Values**        | `default_value = "x"`    | `default: 'x'`              | ✅     | Supported in `@Arg` config and reflected in help text.                           |
| **Value Validation**      | `value_parser`           | `valueParser: fn`           | ✅     | Partial support via `valueParser` function and `type` property in `@Arg`.        |
| **Enumerated Values**     | `value_enum`             | `possibleValues`            | ✅     | Supported via `possibleValues` in `@Arg` and the `@ValueEnum` decorator.         |
| **Collections**           | `Vec<T>`                 | `action: ArgAction.Append`  | ✅     | Supported via `action: ArgAction.Append`.                                        |
| **Argument Groups**       | `ArgGroup`               | ❌                          | ❌     | Missing. Logic for "XOR" (mutually exclusive) or "AND" (required together) args. |
| **Value Delimiters**      | `value_delimiter = ','`  | ❌                          | ❌     | Missing. Handling lists via comma separation vs multiple flags.                  |
| **Shell Completions**     | `clap_complete`          | ❌                          | ❌     | Missing. Generation of scripts for bash/zsh/fish.                                |
| **Man Page Generation**   | `clap_mangen`            | ❌                          | ❌     | Missing. Documentation generation.                                               |
| **Colored Help**          | `color` feature          | ❌                          | ❌     | Missing. ANSI styling for help output.                                           |
| **Suggestions**           | "Did you mean...?"       | ❌                          | ❌     | Missing. Levenshtein distance for typos.                                         |
| **Custom Usage**          | `override_usage`         | ❌                          | ❌     | Missing. Ability to override the auto-generated usage string.                    |

## 1. Terminology & Alignment

To reduce cognitive load for developers moving between Rust and TypeScript,
`clepo` will adopt `clap`'s terminology.

| Concept          | Clap (Rust)         | Clepo (TS)    | Definition                                                                         |
| :--------------- | :------------------ | :------------ | :--------------------------------------------------------------------------------- |
| **Command**      | `Command`           | `Command`     | The primary building block. Represents the application or a subcommand.            |
| **Argument**     | `Arg`               | `Arg`         | A single command-line argument (flag, option, or positional).                      |
| **Command**      | `#[derive(Parser)]` | `@Command`    | The primary decorator for struct/class-based CLI definition.                       |
| **Action**       | `ArgAction`         | `ArgAction`   | Logic to execute when an argument is encountered (e.g., `Set`, `Append`, `Count`). |
| **Value Parser** | `ValueParser`       | `ValueParser` | Validation and typing logic (e.g., `range`, `file_path`).                          |
| **Arg Group**    | `ArgGroup`          | `ArgGroup`    | Defines relationships like exclusion (XOR) or requirements (AND).                  |

## 2. Architecture

The architecture maps to `clap`'s split between the "Builder" API (imperative)
and the "Derive" API (declarative).

### 2.1 Core: The Builder (`clepo/builder`)

This is the foundation. It should work independently of decorators.

- **`Command` Class**:
  - Properties: `name`, `version`, `about`, `subcommands`, `args`.
  - Methods: `arg()`, `subcommand()`, `group()`, `getMatches()`.
  - _Internal_: Manages the graph of commands.

- **`Arg` Class**:
  - Properties: `id`, `short`, `long`, `help`, `action`, `value_parser`,
    `default_value`.
  - _Internal_: Defines how to parse a specific token.

- **Lexer & Parser**:
  - Replace `std/flags` with a custom state-machine lexer inspired by
    `clap_lex`.
  - Needs to distinguish `--flag=value`, `--flag value`, `-fvalue`, `-f=value`,
    and `-f` (boolean).

### 2.2 Interface: The Decorators (`clepo/derive`)

This layer uses TypeScript decorators to generate the Builder graph at runtime.

- **`@Command(config)`**: Marks a class as a CLI entry point. Equivalent to
  `#[derive(Parser)]`.
- **`@Subcommand(classes)`**: Registers subcommand classes.
- **`@Arg(config)`**: Marks a property as an argument.
  - Unlike the current `@Option` vs `@Arg`, we will use a single `@Arg`
    decorator.
  - Distinction between Positional and Named is inferred or explicit via `index`
    property, just like `clap`.
- **`@ValueEnum`**: Marks a TypeScript Enum as a valid set of inputs.

## 3. Proposed API (v0.2)

```typescript
import { Arg, ArgAction, Command, Subcommand } from "clepo";

// Subcommand Definition
@Command({ about: "Add file contents to the index" })
class Add {
  @Arg({ help: "Files to add", required: true, action: ArgAction.Append })
  pathspec!: string[]; // Positional because no 'short' or 'long' specified

  @Arg({ short: "n", long: true, help: "Dry run" })
  dryRun: boolean = false;
}

// Main Application
@Command({
  name: "git",
  version: "2.40.0",
  about: "A stupid content tracker",
  propagateVersion: true,
})
class Git {
  // Global Flag
  @Arg({ short: "v", long: true, action: ArgAction.Count, global: true })
  verbose!: number;

  @Arg({ long: "config", env: "GIT_CONFIG" })
  configPath?: string;

  // Subcommands
  @Subcommand([Add])
  command!: Add; // The matched subcommand instance is injected here
}
```

## 4. Implementation Phases

### Phase 1: Core Architecture Rewrite (v0.2)

**Goal**: Establish the `Command` and `Arg` structures and the aligned Decorator
API.

1. **Refactor `types.ts`**:
   - The interface for command configuration will be named `CommandConfig`.
   - Rename `ArgConfig` -> `Arg`.
   - Add `ArgAction` enum (`Set`, `Append`, `SetTrue`, `SetFalse`, `Count`,
     `Help`, `Version`).
2. **Refactor `decorators.ts`**:
   - Deprecate/Remove `@Option` and the original `@Command` decorator.
   - Implement the new `@Command`, `@Subcommand`, and `@Arg` decorators.
   - Implement Reflection logic to map Property Types to `ArgAction` defaults
     (e.g., `boolean` -> `SetTrue`, `number` -> `Set` or `Count`??).
3. **Refactor `app.ts` -> `Cli.ts`**:
   - Re-implement the runtime loop.
   - Basic "Positional vs Flag" logic using the new structures.

### Phase 2: Robust Parsing & Validation (v0.3)

**Goal**: Replace `std/flags` and implement `ValueParser`.

1. **Lexer**: Implement `Lexer` to handle `short` clusters (`-xvf`) and `long`
   values correctly.
2. **ValueParser**:
   - Add `valueParser` option to `@Arg`.
   - Implement built-ins: `valueParser: 'number'`, `valueParser: 'file'`.
   - Support custom functions: `(val: string) => T`.
3. **Environment Variables**: Support `env` key in `@Arg`.

### Phase 3: Polish & Help (v0.4)

**Goal**: formatting and display.

1. **Help Generation**:
   - Auto-generate Usage string.
   - Format help text similar to `clap` (aligned columns).
   - Support colored output (ANSI).
2. **Version**:
   - Auto-implement `-V` / `--version`.

## 5. Migration Guide (Internal)

- `@Command` -> `@Command` (New API)
- `@Option` -> `@Arg({ long: true })`
- `@Arg` (Positional) -> `@Arg` (no flags)
- `subcommands: []` in config -> `@Subcommand` decorator on a property
  (preferred) or class level config.
