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
