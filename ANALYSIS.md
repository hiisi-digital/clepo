# clepo Codebase Analysis

> **Last Updated**: Post-refactor. This document reflects the current architecture
> after the comprehensive rewrite to align with `clap`'s design principles.

## 1. Architecture Overview

The clepo library now follows a clean, phase-separated architecture inspired by
Rust's `clap` crate:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BUILD PHASE                                  │
│  Decorators (@Command, @Arg, @Subcommand) → Command Tree (Metadata) │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       FINALIZE PHASE                                 │
│  Command.finalize() → Propagate globals, inject help/version args   │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         PARSE PHASE                                  │
│  RawArgs + Lexer → Parser (Recursive Descent) → ArgMatches          │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       VALIDATE PHASE                                 │
│  ArgMatches → Check required args, groups, conflicts                │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        HYDRATE PHASE                                 │
│  ArgMatches → CommandInstance (User's decorated class)              │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Core Components

### 2.1. Lexer (`lexer.ts`)

Implements a `clap_lex`-style tokenizer:

- **`RawArgs`**: Cursor-based container for raw argument strings
- **`ParsedArg`**: Represents a single uninterpreted argument with query methods:
  - `isLong()`, `toLong()` - Handle `--flag` and `--flag=value`
  - `isShort()`, `toShort()` - Handle `-f`, `-fvalue`, `-abc` clusters
  - `isEscape()` - Detect `--` separator
  - `isNegativeNumber()` - Distinguish `-123` from `-v`
- **`ShortFlags`**: Iterator for walking clustered short flags

### 2.2. Parser (`parser.ts`)

Recursive descent parser that:

1. Consumes tokens linearly
2. Matches flags/positionals against the current command's arg definitions
3. Recursively descends into subcommands when matched
4. Populates an `ArgMatcher` with raw match data
5. Delegates to validation and hydration phases

Key design decisions:

- **No pre-scanning**: Unlike the old broken implementation, subcommands are
  detected during linear parsing, not via lookahead
- **Early exit for help/version**: `ArgAction.Help` and `ArgAction.Version`
  trigger early return before validation
- **Separation of concerns**: Parser only populates `ArgMatches`, never touches
  user instances directly

### 2.3. ArgMatcher / ArgMatches (`arg_matcher.ts`)

The critical abstraction that was previously missing:

- **`ArgMatcher`**: Mutable helper used during parsing to accumulate matches
- **`ArgMatches`**: Immutable read-only view of parsing results

Tracks:

- Argument IDs and their values
- Occurrence counts (for `ArgAction.Count`)
- Value sources (CLI, env, default)
- Nested subcommand matches

### 2.4. Command (`command.ts`)

The builder class representing a CLI command:

- Holds args, subcommands, groups, and settings
- `finalize()` method propagates globals and injects built-in args
- `run()` method orchestrates the full parse-validate-execute flow

### 2.5. Decorators (`decorators.ts`)

TypeScript decorators for the "Derive API":

- `@Command(config)` - Marks a class as a command
- `@Arg(config)` - Marks a property as an argument
- `@Subcommand(classes)` - Registers subcommand classes
- `@ValueEnum(enumObj)` - Restricts values to an enum

### 2.6. Reflect (`reflect.ts`)

Metadata management singleton:

- Stores/retrieves decorator metadata using `Reflect.metadata`
- Normalizes targets (prototype vs constructor) internally
- Retrieves design-time type information for type inference

## 3. Clap Alignment Status

| Feature                   | Clap Behavior                    | Clepo Status | Notes                                       |
| :------------------------ | :------------------------------- | :----------- | :------------------------------------------ |
| **Recursive Parsing**     | Linear parse, recurse on subcmd  | ✅ Aligned   | Proper recursive descent                    |
| **ArgMatches**            | Intermediate parse result        | ✅ Aligned   | Full `ArgMatcher`/`ArgMatches` abstraction  |
| **Phase Separation**      | Parse → Validate → Hydrate       | ✅ Aligned   | Clean separation                            |
| **Help/Version Injection**| Auto-injected based on settings  | ✅ Aligned   | Proper `ArgAction.Help/Version`             |
| **Global Args**           | Propagated to subcommands        | ✅ Aligned   | Via `finalize()`                            |
| **Argument Groups**       | XOR/AND relationships            | ⚠️ Partial  | Basic support, needs more testing           |
| **Conflicts**             | `conflicts_with` checks          | ✅ Aligned   | Implemented in validation                   |
| **Value Delimiters**      | `,` separation within flag       | ❌ Missing   | Future enhancement                          |
| **Shell Completions**     | `clap_complete`                  | ❌ Missing   | Out of scope for now                        |
| **Suggestions**           | "Did you mean...?"               | ❌ Missing   | Future enhancement                          |

## 4. Code Quality

### 4.1. Strengths

- **Clean module boundaries**: Each file has a single responsibility
- **Type safety**: Minimal use of `any`, proper TypeScript idioms
- **Error handling**: Structured `ClepoError` with `ErrorKind` enum
- **Documentation**: JSDoc comments on public APIs
- **Test coverage**: Comprehensive integration tests

### 4.2. Potential Improvements

1. **Performance**: `finalize()` could be lazy-loaded on first parse
2. **Decorator deprecation warning**: TypeScript's `experimentalDecorators` is
   deprecated; consider migration path to TC39 decorators
3. **Debug logging**: Could use a proper debug library instead of `console.log`

## 5. API Summary

### Builder API

```typescript
import { ArgAction, ArgBuilder, Command, CommandSettings } from "@loru/clepo";

const cmd = new Command("myapp")
  .setVersion("1.0.0")
  .setAbout("My application")
  .addArg(
    new ArgBuilder({
      id: "verbose",
      short: "v",
      long: "verbose",
      action: ArgAction.Count,
    })
  )
  .setting(CommandSettings.PropagateVersion);

await cmd.run();
```

### Decorator API

```typescript
import { Arg, Cli, CommandDecorator, Subcommand } from "@loru/clepo";

@CommandDecorator({ name: "myapp", version: "1.0.0" })
class MyApp {
  @Arg({ short: "v", long: true, action: ArgAction.Count })
  verbose = 0;

  @Subcommand([SubCmd])
  command!: SubCmd;

  async run() {
    console.log(`Verbosity: ${this.verbose}`);
  }
}

await Cli.run(MyApp);
```

## 6. Testing

Run tests with:

```bash
deno test tests/ --allow-read
```

Current test coverage includes:

- Decorator API parsing
- Builder API parsing
- Help/version flag detection
- Environment variable reading
- Value parsing (number, custom parsers)
- Possible values validation
- Error handling (unknown args, missing required, invalid values)
- Default values
- Long/short flag variations
- Command settings (SubcommandRequired)
