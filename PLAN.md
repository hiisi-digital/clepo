# Feature Parity Analysis: Clepo vs. Clap

This document outlines the feature set of Rust's `clap` crate and analyzes the
gap for `clepo`.

## Feature Matrix

| Feature                   | Clap (Rust)                      | Clepo (Deno)      | Status                                            | Notes                                                          |
| :------------------------ | :------------------------------- | :---------------- | :------------------------------------------------ | :------------------------------------------------------------- |
| **Derive/Decorator API**  | `#[derive(Parser)]`              | `@Command`        | ✅                                                | Core implemented.                                              |
| **Subcommands**           | `#[command(subcommand)]`         | `subcommands: []` | ✅                                                | Supported via recursion.                                       |
| **Flags/Options**         | `#[arg(short, long)]`            | `@Option`         | ✅                                                | Basic support.                                                 |
| **Positional Args**       | `#[arg]` (no flags)              | `@Arg`            | ✅                                                | Basic support.                                                 |
| **Global Arguments**      | `global = true`                  | `global: true`    | ✅                                                | Supported.                                                     |
| **Aliases**               | `visible_aliases`                | `aliases`         | ✅                                                | Supported.                                                     |
| **Environment Variables** | `env = "MY_VAR"`                 | ❌                | **Missing**. Critical for 12-factor apps.         |                                                                |
| **Default Values**        | `default_value = "x"`            | Property init     | ⚠️                                                | Partial. Need explicit metadata for help text vs actual value. |
| **Value Validation**      | `value_parser`, `conflicts_with` | ❌                | **Missing**. Need `validator` function or schema. |                                                                |
| **Argument Groups**       | `ArgGroup`                       | ❌                | **Missing**. (e.g., "xor" between flags).         |                                                                |
| **Shell Completions**     | `clap_complete`                  | ❌                | **Missing**. Huge DX feature.                     |                                                                |
| **Man Page Generation**   | `clap_mangen`                    | ❌                | **Missing**. Nice to have.                        |                                                                |
| **Help/Version Flags**    | Auto `-h`, `-V`                  | `-h` only         | ⚠️                                                | Need standard `-V` implementation.                             |
| **Colored Help**          | Standard                         | ❌                | **Missing**. Makes help readable.                 |                                                                |
| **Suggestion**            | "Did you mean...?"               | ❌                | **Missing**. Typo fixing.                         |                                                                |

## Implementation Plan

### Phase 1: Robustness (v0.2)

Focus on making the parsing logic rock solid and standard compliant.

- [ ] **Environment Variables**: Add `env` to `ArgConfig`. If flag is missing,
      check `Deno.env`.
- [ ] **Default Values**: Capture default values in metadata to show
      `[default: x]` in help.
- [ ] **Validation**: Add `validate: (val: T) => boolean | string` to config.
- [ ] **Version Flag**: specific handling for `-V` / `--version` to print
      `meta.version`.

### Phase 2: User Experience (v0.3)

Focus on the end-user experience of the CLI tool.

- [ ] **Colored Help**: Use standard ANSI colors (bold headers, green flags) for
      the help output.
- [ ] **Suggestions**: Implement Levenshtein distance for "Unknown command"
      errors.
- [ ] **Argument Groups**: Support `conflictsWith` and `requires` in
      `ArgConfig`.

### Phase 3: Ecosystem (v0.4)

Focus on distribution and integration.

- [ ] **Shell Completions**: Add a hidden command `completions <shell>` that
      outputs the completion script for Bash/Zsh/Fish.
- [ ] **Man Pages**: Generate troff format documentation.

## Technical Debt / Refactor

- **Parser**: Currently using `std/flags`. Consider moving to a custom parser or
  wrapping `cliffy/flags` to support more advanced grouping/conflict logic if
  `std` is too limited.
- **Testing**: Add unit tests for the `Cli` runner specifically covering edge
  cases in argument parsing.
