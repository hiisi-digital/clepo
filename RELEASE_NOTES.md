# clepo Release Notes

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
