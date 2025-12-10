# Feature Parity Analysis: Clepo vs. Clap

This document outlines the feature set of Rust's `clap` crate and analyzes the
gap for `clepo`.

**Reference Documentation:**

- [Clap Docs (Latest)](https://docs.rs/clap/latest/clap/)
- [Clap Concepts](https://docs.rs/clap/latest/clap/_concepts/index.html)
- [Clap FAQ](https://docs.rs/clap/latest/clap/_faq/index.html)
- [Clap Cookbook](https://docs.rs/clap/latest/clap/_cookbook/index.html)
- [Clap GitHub Repository](https://github.com/clap-rs/clap)

_(Local source code available in `./docs_ref/clap/`)_

## Feature Matrix

| Feature                   | Clap (Rust)              | Clepo (Deno)      | Status                                                                               | Notes                                                                                  |
| :------------------------ | :----------------------- | :---------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **API Style**             | `#[derive(Parser)]`      | `@Command`        | ✅                                                                                   | Core decorator API implemented.                                                        |
| **Subcommands**           | `#[command(subcommand)]` | `subcommands: []` | ✅                                                                                   | Supported via recursion in `app.ts`.                                                   |
| **Positional Args**       | `#[arg]` (no flags)      | `@Arg`            | ✅                                                                                   | Basic mapping by index/order.                                                          |
| **Named Options**         | `#[arg(short, long)]`    | `@Option`         | ✅                                                                                   | Supports `-f`, `--flag`.                                                               |
| **Global Arguments**      | `global = true`          | `global: true`    | ✅                                                                                   | Propagates to subcommands.                                                             |
| **Aliases**               | `visible_aliases`        | `aliases`         | ✅                                                                                   | Command aliases supported.                                                             |
| **Boolean Flags**         | `action = SetTrue`       | `type: boolean`   | ✅                                                                                   | Presence equals true.                                                                  |
| **Auto-Help**             | `-h`, `--help`           | `-h`, `--help`    | ✅                                                                                   | Generates usage and description.                                                       |
| **Environment Variables** | `env = "MY_VAR"`         | ❌                | **Missing**. Critical for 12-factor apps configuration.                              |                                                                                        |
| **Default Values**        | `default_value = "x"`    | Property init     | ⚠️                                                                                   | **Partial**. Values work via class init, but not reflected in help text automatically. |
| **Value Validation**      | `value_parser`           | ❌                | **Missing**. No custom validation logic (e.g., file exists, range).                  |                                                                                        |
| **Enumerated Values**     | `value_enum`             | ❌                | **Missing**. restricting input to a specific set (enum).                             |                                                                                        |
| **Argument Groups**       | `ArgGroup`               | ❌                | **Missing**. Logic for "XOR" (mutually exclusive) or "AND" (required together) args. |                                                                                        |
| **Value Delimiters**      | `value_delimiter = ','`  | ❌                | **Missing**. Handling lists via comma separation vs multiple flags.                  |                                                                                        |
| **Collections**           | `Vec<T>`                 | `type: "list"`    | ⚠️                                                                                   | **Partial**. Basic support implies list, but needs robust `action=Append` handling.    |
| **Shell Completions**     | `clap_complete`          | ❌                | **Missing**. Generation of scripts for bash/zsh/fish.                                |                                                                                        |
| **Man Page Generation**   | `clap_mangen`            | ❌                | **Missing**. Documentation generation.                                               |                                                                                        |
| **Version Flag**          | `-V`, `--version`        | ❌                | **Missing**. Standard version printout.                                              |                                                                                        |
| **Colored Help**          | `color` feature          | ❌                | **Missing**. ANSI styling for help output.                                           |                                                                                        |
| **Suggestions**           | "Did you mean...?"       | ❌                | **Missing**. Levenshtein distance for typos.                                         |                                                                                        |
| **Custom Usage**          | `override_usage`         | ❌                | **Missing**. ability to override the auto-generated usage string.                    |                                                                                        |

## Architecture & Concepts

To achieve parity with `clap`, `clepo` should mirror key architectural
components and concepts found in the Rust crate. This section highlights which
parts of `clap` serve as inspiration for corresponding TypeScript
implementations.

### 1. The Builder Pattern

`clap_builder` constructs the command graph and parsing rules. While `clepo`
uses decorators for the high-level API, internally it must convert these into a
robust `Command` definition structure similar to `clap_builder`.

- **Source Reference**: `clap_builder/src/builder/command.rs` &
  `clap_builder/src/builder/arg.rs`
- **Concept**: A `Command` (App) contains a list of `Arg`s, `ArgGroup`s, and
  subcommands.
- **TS Implementation**: Our `CommandConfig` and `ArgConfig` interfaces in
  `types.ts` should evolve to match the richness of `clap::Command` and
  `clap::Arg`.

### 2. Argument Actions

In `clap`, `ArgAction` defines what happens when an argument is encountered
(e.g., `Set`, `Append`, `SetTrue`, `Count`). `clepo` currently infers this from
types, but explicit actions are needed for complex behaviors.

- **Source Reference**: `clap_builder/src/builder/action.rs`
- **Concept**: Decoupling the "what" (flag presence) from the "how" (storage
  logic).
- **TS Implementation**: Add an `action` property to `ArgConfig` to support
  `count` (`-vvv`) and `append` (`--item a --item b`).

### 3. The Lexer

`clap` separates lexing (breaking strings into raw arguments) from parsing
(matching args to rules). `std/flags` combines these somewhat rigidly.

- **Source Reference**: `clap_lex/src/lib.rs`
- **Concept**: A state-machine lexer that handles short flag clusters (`-xvf`),
  long flags with values (`--opt=val` vs `--opt val`), and positional delimiters
  (`--`).
- **TS Implementation**: Eventually, replace `std/flags` with a custom `Lexer`
  class that mimics `clap_lex`'s robust tokenization, feeding into a `Parser`
  that applies the Command graph constraints.

### 4. Validation & Parsing

`clap` uses `ValueParser` to convert string inputs into typed values and
validate them (e.g. `PathBuf`, `u32`, `enum`).

- **Source Reference**: `clap_builder/src/builder/value_parser.rs` &
  `clap_builder/src/parser/validator.rs`
- **Concept**: Arguments define how they should be parsed and validated.
- **TS Implementation**: Introduce a `Validator` or `Parser` type in `ArgConfig`
  that accepts `(input: string) => Result<T, Error>`. This allows for reusable
  logic like "file must exist" or "integer range".

### 5. Derive Macro Logic

`clap_derive` is the "compiler" that translates struct attributes into
`clap_builder` calls. `clepo`'s decorators perform the exact same role at
runtime (via reflection).

- **Source Reference**: `clap_derive/src/derives/parser.rs` &
  `clap_derive/src/derives/args.rs`
- **Concept**: Recursively traversing fields to build the `Command` tree.
- **TS Implementation**: The `decorators.ts` module is the direct equivalent. We
  should study `clap_derive` to ensure we handle things like
  `#[command(flatten)]` (reusing argument sets) which `clepo` doesn't yet
  support (mixin classes).

## Implementation Plan

### Phase 1: Robustness (v0.2)

Focus on making the parsing logic rock solid, standard compliant, and
informative.

- [ ] **Environment Variables**: Add `env` to `ArgConfig`. If CLI flag is
      missing, check `Deno.env`.
- [ ] **Default Values Metadata**: Capture default values in metadata to show
      `[default: x]` in help text.
- [ ] **Validation API**: Add `validate: (val: T) => boolean | string` to
      `ArgConfig`.
- [ ] **Enumerated Values**: Add `possibleValues: string[]` to `ArgConfig` for
      strict checking.
- [ ] **Version Flag**: Add specific handling for `-V` / `--version` to print
      `meta.version` (read from deno.json if possible).

### Phase 2: User Experience (v0.3)

Focus on the end-user experience of the CLI tool built with Clepo.

- [ ] **Colored Help**: Use standard ANSI colors (bold headers, green flags) for
      the help output.
- [ ] **Suggestions**: Implement Levenshtein distance algorithm for "Unknown
      command" errors.
- [ ] **Argument Groups**: Support `conflictsWith` and `requires` in `ArgConfig`
      to handle simple groups.
- [ ] **Custom Help Templates**: Allow overriding the default help message
      layout.

### Phase 3: Ecosystem (v0.4)

Focus on distribution and integration features.

- [ ] **Shell Completions**: Add a hidden command `completions <shell>` that
      outputs the completion script for Bash/Zsh/Fish.
- [ ] **Man Pages**: Generate troff format documentation for package
      distribution.
- [ ] **Value Delimiters**: Support comma-separated values for list types.

## Technical Debt / Refactor

- **Parser Backend**: Currently using `std/flags`. While simple, it limits
  complex group logic (XOR/AND) and precise token handling (e.g. distinguishing
  `-ovalue` from `-o value` in some contexts).
  - _Recommendation_: Study `clap_lex` (in `./docs_ref/clap/clap_lex`) for how a
    robust lexer is implemented, and consider implementing a similar
    state-machine based parser in TypeScript if `std/flags` becomes a bottleneck
    for Phase 2 features. WASM bindings for `clap` itself are deemed too
    heavy/complex for this project's goals.
- **Testing**: Add unit tests for the `Cli` runner specifically covering edge
  cases (e.g., `--flag value`, `--flag=value`, `-f value`, clustered shorts
  `-xvf`).
