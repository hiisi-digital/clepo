# clepo Release Notes

## v0.5.0: Clap-like Subcommands API

This release introduces a new `Subcommands()` factory function that provides a
clap-like ergonomic API for defining subcommand enums, with automatic type
inference.

### New Features

- **`Subcommands()` Factory**: A new function that creates a subcommand "enum"
  from a list of command classes. The type is automatically inferred as a union.

```typescript
// Define subcommand classes
@Command({ about: "Clone a repository" })
class CloneCmd {
  @Arg({ required: true })
  remote!: string;
  async run() {/* ... */}
}

@Command({ about: "Show diff" })
class DiffCmd {
  @Arg({ long: "base" })
  base?: string;
  async run() {/* ... */}
}

// Create the "enum" - just like Rust's #[derive(Subcommand)] enum!
const Commands = Subcommands(CloneCmd, DiffCmd);

// Use in main CLI - type is automatically CloneCmd | DiffCmd
@Command({ name: "git", version: "1.0.0" })
class GitCli {
  command = Commands; // That's it!
  async run() {/* ... */}
}
```

- **Auto-detection**: Properties initialized with `Subcommands()` are
  automatically detected - no `@Subcommand` decorator required!

- **Multiple Usage Patterns**: Three ways to use the new API:
  1. Auto-detection: `command = Commands;`
  2. Explicit decorator: `@Subcommand(Commands) command = Commands;`
  3. Empty decorator: `@Subcommand() command = Commands;`

- **Backward Compatibility**: The original array-based `@Subcommand([...])` API
  continues to work unchanged.

### Comparison to Rust clap

| Rust clap                       | TypeScript clepo                            |
| :------------------------------ | :------------------------------------------ |
| `enum Commands { Clone, Diff }` | `const Commands = Subcommands(Clone, Diff)` |
| `command: Commands`             | `command = Commands`                        |

### API Changes

- **Renamed `CommandDecorator` to `Command`**: The decorator is now simply
  `@Command`, which is cleaner and more intuitive.
- **Renamed `Command` to `CommandBuilder`**: The builder API class is now
  `CommandBuilder` to avoid naming conflicts with the decorator.

### New Exports

- `Command`: The class decorator (renamed from `CommandDecorator`)
- `CommandBuilder`: The builder class (renamed from `Command`)
- `Subcommands`: The factory function for creating subcommand enums
- `SubcommandsMarker`: Internal marker type (for advanced use)
- `SubcommandsResult`: The branded return type of `Subcommands()`

### New Error Kinds

- `ErrorKind.MissingSubcommand`: When a required subcommand is not provided
- `ErrorKind.ArgumentConflict`: When mutually exclusive arguments are used

### Improvements

- **Expanded Test Suite**: Increased from 65 to 72 integration tests covering
  all new `Subcommands()` patterns.
- **Updated Documentation**: README updated with comprehensive examples of the
  new API.
- **Improved Error Messages**: All error messages now include helpful context,
  usage hints, and suggestions where applicable.

### Internal

- New symbol-based marker system for runtime detection of subcommand metadata
- `ClepoError.format()` method for user-friendly error display
- `ClepoError.kindName()` method for debugging
- All 72 tests pass
- Zero lint errors

---

## v0.4.2: Stabilization

This release completes the v0.4.x stabilization phase with new value parsers,
typo suggestions, and the ability to hide internal arguments.

### New Features

- **Boolish Value Parser**: Accepts flexible boolean inputs (yes/no, on/off,
  true/false, 1/0). Use `valueParser: "boolish"` in your argument config.

```typescript
debug = false;
// Accepts: --debug yes, --debug on, --debug 1, --debug true
```

- **Ranged Integer Parser**: Validates integers within a specified range
  (inclusive). Use `valueParser: { ranged: [min, max] }`.

```typescript
port = 8080;
// Rejects values outside 1-65535
```

- **Hide Option**: Arguments can be hidden from help output while still being
  parseable. Useful for internal or deprecated flags.

```typescript
internalDebug = false;
// Won't appear in --help, but still works
```

- **Typo Suggestions**: When users provide an unknown argument, clepo now
  suggests similar options using Levenshtein distance.

```
$ myapp --verbos
error: Found argument '--verbos' which wasn't expected.

    tip: a similar argument exists: '--verbose'

For more information, try '--help'.
```

### Improvements

- **Expanded Test Suite**: Increased from 47 to 65 integration tests covering
  all new features.
- **Utility Module**: Added `util.ts` with Levenshtein distance functions that
  can be reused.
- **Updated Documentation**: README overhauled with low-ego, professional tone
  and comprehensive inline-commented examples.

### Internal

- New exports: `parseBoolish`, `createRangedParser`, `BuiltinValueParser` type
- All 65 tests pass
- Zero lint errors

---

## v0.4.1: Code Quality & TC39 Future-Proofing

This release focuses on code quality improvements and preparing for the eventual
migration to TC39 Stage 3 decorators.

### New Features

- **Explicit Type Configuration**: The `@Arg` decorator now accepts an explicit
  `type` option (`"string"`, `"number"`, `"boolean"`, `"list"`) that takes
  precedence over reflection-based inference. This future-proofs your code for
  TC39 decorators which don't support `emitDecoratorMetadata`.

```typescript
// Works without reflection metadata (TC39-ready)
@Arg({ long: "count", type: "number" })
count!: number;
```

### Improvements

- **Modern Linting**: Added comprehensive Deno lint configuration with strict
  rules including `explicit-function-return-type`, `ban-untagged-todo`,
  `eqeqeq`, and more.
- **Consistent Formatting**: Added `deno fmt` configuration with 100-char line
  width and consistent style.
- **Explicit Return Types**: All functions now have explicit return types.
- **Tagged TODOs**: All TODO comments now reference issues for tracking.
- **Expanded Test Suite**: Increased from 42 to 47 integration tests, including
  explicit type configuration tests.
- **JSR Publish Config**: Added `publish` configuration in `deno.json` for clean
  JSR publishing.
- **New Task Commands**: Added `deno task all`, `deno task prepublish`,
  `deno task fmt:check`, and `deno task test:coverage`.

### Research

Comprehensive research was conducted on TC39 decorators, TypeScript's roadmap,
Deno 2.0, and alternative metaprogramming approaches (macros, attributes). Key
findings:

- **No alternatives to decorators are coming** - TC39 and TypeScript have no
  plans for C#-style attributes or macro systems
- **TC39 Decorator Metadata** (`Symbol.metadata`) is the replacement for
  `emitDecoratorMetadata`
- **Hybrid approach recommended** - Support both TC39 and legacy decorators

See `/research/00-SUMMARY.md` for full details.

### Internal

- All source files pass strict `deno lint` rules
- Zero formatting issues via `deno fmt --check`
- All 47 tests pass

---

## v0.4.0: Architecture Refactor

This is a major release that completely refactors the parsing architecture to
align with Rust's `clap` crate patterns.

### Breaking Changes

- **API Restructure**: The `Cli` export is now an object with a `run()` method
  rather than a class constructor. Use `Cli.run(MyCommand)` instead of
  `new Cli(MyCommand).run()`.
- **Decorator Rename**: The `@Command` decorator is exported as
  `@CommandDecorator` from `mod.ts` to avoid conflict with the `Command` class.

### New Features

- **Auto-injected Help/Version**: `-h/--help` and `-V/--version` flags are now
  automatically injected based on `CommandSettings`. No need to manually define
  them.
- **Recursive Descent Parser**: Complete rewrite of the parser to use proper
  recursive descent, fixing issues with subcommand resolution and flag parsing.
- **ArgMatches Abstraction**: Introduced `ArgMatcher` and `ArgMatches` classes
  for proper separation between parsing and hydration phases.
- **Comprehensive Error Handling**: Structured `ClepoError` with `ErrorKind`
  enum for programmatic error handling.
- **Escape Sequence Support**: Proper handling of `--` to treat subsequent
  arguments as positional values.
- **Conflicts Support**: Arguments can now declare `conflictsWith` to enforce
  mutual exclusivity.
- **Builder API**: Full support for imperative command construction via the
  `Command` and `ArgBuilder` classes.

### Bug Fixes

- Fixed metadata lookup issue where decorator API failed to recognize arguments
  due to prototype vs constructor confusion in reflection.
- Fixed magic number usage in validation (now uses `CommandSettings` enum).
- Fixed number parsing for arguments with `type: "number"`.

### Improvements

- **Lint Compliance**: All source files now pass Deno's strict linter.
- **Type Safety**: Reduced `any` usage throughout the codebase.
- **Test Coverage**: Expanded from 3 tests to 42 comprehensive integration tests
  covering all major features.
- **Documentation**: Updated README, ANALYSIS.md, and inline JSDoc comments.

### Architecture

The new architecture follows a clean phase separation:

1. **Build**: Decorators store metadata on classes
2. **Finalize**: Command tree is finalized (globals propagated, built-ins
   injected)
3. **Parse**: Lexer tokenizes, Parser builds ArgMatches recursively
4. **Validate**: Required args, groups, and conflicts are checked
5. **Hydrate**: ArgMatches are applied to user class instances

---

## v0.3.0: Parser Improvements

- Implemented custom lexer inspired by `clap_lex`
- Added support for short flag clusters (`-abc`)
- Added support for attached values (`-n4`, `--name=value`)
- Environment variable support via `env` option

---

## v0.2.1: Polish

Small patch release completing Phase 1 architectural refactor.

- Renamed `app.ts` to `cli.ts` to better reflect its purpose.

---

## v0.2.0: Core Architecture

Initial implementation of the clap-inspired API.

- `@Command`, `@Arg`, `@Subcommand` decorators
- Basic parsing and help generation
- Colored help output
