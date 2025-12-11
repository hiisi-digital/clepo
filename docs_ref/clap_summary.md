# Clap Architecture & Implementation Summary

This document summarizes the internal architecture, algorithms, and idioms of the Rust `clap` crate (v4+), based on source code analysis. It serves as a reference for implementing `clepo`.

## 1. Core Architecture

`clap` follows a "Builder" pattern where the CLI definition is constructed at runtime (even when using the Derive API, which expands to Builder calls).

### 1.1 Key Components

*   **`Command` (Builder)**: The root object. Represents an application or subcommand.
    *   Stores: `args` (MKeyMap), `subcommands` (Vec), `groups`, `settings`, `help_template`, `version`, etc.
    *   Idiom: Mutable builder pattern (`.arg(...)`, `.subcommand(...)`).
*   **`Arg` (Builder)**: Represents a single argument definition.
    *   Stores: `id`, `short`, `long`, `action`, `num_args`, `default_value`, `conflicts`, `requires`.
*   **`Parser`**: The engine that drives the logic. It wraps a mutable `Command`.
    *   Orchestrates the `Lexer` and `ArgMatcher`.
    *   Recursive: A new `Parser` is created for each subcommand encountered.
*   **`ArgMatcher`**: Accumulates the results of parsing.
    *   Stores matched values and indices.
    *   Transforms into `ArgMatches` (the public result object) at the end.
*   **`clap_lex` (Lexer)**: A distinct, low-level module that tokenizes raw OS arguments.
    *   "Dumb": Does not know about the command definition. Just identifies `Long`, `Short`, `Escape`, `Value`.

## 2. The Lexing Strategy (`clap_lex`)

`clap` does not use a traditional regex-based tokenizer. It uses a cursor-based iterator over `OsString`s.

*   **`RawArgs`**: Wrapper around the raw argument list.
*   **`ArgCursor`**: Tracks the current index in the list.
*   **`ParsedArg`**: Classification of a token.
    *   `is_long()`: Starts with `--` (and not `--`).
    *   `is_short()`: Starts with `-` (and not `-` or `--`).
    *   `is_escape()`: Is exactly `--`.
    *   `is_stdio()`: Is exactly `-`.
    *   `is_number()`: Heuristic to distinguish negative numbers (`-1`) from short flags.

**Crucially**, the lexer exposes methods to "peek" and methods to "split" tokens (e.g., separating `-fvalue` into `-f` and `value` happens lazily via `ShortFlags` iterator).

## 3. The Parsing Algorithm

The `Parser::get_matches_with` loop is the heart of the logic.

### 3.1 The Loop
It iterates over tokens from the Lexer. It maintains a `ParseState` (`ValuesDone`, `Opt(Id)`, `Pos(Id)`) to know if it's currently consuming values for a previous option.

1.  **Subcommand Check**: Before processing as a flag/arg, it checks if the token matches a subcommand name (unless `args_conflicts_with_subcommands` is set).
    *   If matched: Parsing for the current command stops. The remaining args are handed off to a new `Parser` for the subcommand.
2.  **Escape (`--`)**: Switches the parser to "Trailing Values" mode. All subsequent tokens are treated as positional values.
3.  **Long Flags (`--flag` or `--flag=val`)**:
    *   Parses optional value (`=val`).
    *   Validates against defined `Args`.
    *   Checks `Action` to decide if it consumes the *next* token as a value.
4.  **Short Flags (`-f` or `-fval` or `-xyz`)**:
    *   Iterates through the cluster (`ShortFlags`).
    *   If a flag in the cluster takes a value, the rest of the cluster is consumed as the value (`-fval` -> `f`=`val`).
    *   If the cluster ends and the flag needs a value, the *next* token is consumed.
5.  **Positional Arguments**:
    *   Maintains a `pos_counter`.
    *   Matches token against the `Arg` at that index.
    *   Handles `num_args` (greedy vs fixed).

### 3.2 Key Algorithms

*   **Inference**:
    *   `infer_long_args`: Allows partial matching (`--ver` -> `--version`) if unambiguous.
    *   `infer_subcommands`: Similar partial matching for subcommands.
*   **Negative Number Handling**:
    *   Disambiguates `-1` (number) from `-1` (short flag `1`) based on configuration (`allow_negative_numbers`).
*   **Interleaved Args**:
    *   By default, flags and positionals can be interleaved.
    *   `ArgsNegateSubcommands`: If a flag is seen, subcommands are disabled (git style vs docker style).

## 4. Argument Actions & Values

`clap` moved away from complex configuration booleans to `ArgAction`.

*   **`Set`**: Overwrites value (default for options).
*   **`Append`**: Adds to list (default for multiple occurrences).
*   **`SetTrue`/`SetFalse`**: For boolean flags.
*   **`Count`**: Increments counter (`-vvv`).
*   **`Help`/`Version`**: Interrupts parsing to print info and exit.

**Value Parsing**:
*   `ValueParser`: A trait for converting string input to typed output.
*   Validations (possible values, range, custom function) happen *during* parsing or immediately after.

## 5. Validation Logic

After the parsing loop completes, `Validator::validate` is called.

1.  **Required Arguments**: Checks if all `required` args are present.
2.  **Conflicts**: Checks `conflicts_with` and `exclusive` constraints.
3.  **Groups**: Validates `ArgGroup` rules (required groups, single-item groups).
4.  **Conditionals**: Evaluates `required_if`, `default_value_if` logic.

## 6. Architecture for Clepo (TS Port)

To align with `clap`, `clepo` must separate the **Definition** (Decorators/Command) from the **Execution** (Parser).

1.  **Reflect/Decorators**: strictly populate a `Command` config structure. They should not contain runtime parsing logic.
2.  **Command Class**: Needs to act as the repository of truth.
3.  **Parser Class**: Needs a distinct state machine.
    *   Must handle the cursor logic (Lexer equivalent).
    *   Must implement the "Short Cluster" unpacking logic (`-xvf` -> `x`, `v`, `f`).
    *   Must handle `subcommand` recursion properly (currently `clepo` seems to do this linearly or ad-hoc).
4.  **Error Handling**: `clap` uses a rich `Error` type that holds context (which arg failed, usage string) to generate pretty error messages. `clepo` needs a structured `ClapError`.
