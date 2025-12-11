# Clepo Development Plan

**Goal**: Create the definitive TypeScript equivalent of Rust's `clap` crate.
**Philosophy**: Strict adherence to `clap`'s architecture, terminology, and
behavior where possible, adapted for TypeScript idioms.

> **Current Version**: 0.5.0
> **Last Updated**: January 2025

---

## Feature Matrix

### Core Features

| Feature                   | Clap (Rust)              | Clepo (TS)                      | Status | Notes                                     |
| :------------------------ | :----------------------- | :------------------------------ | :----- | :---------------------------------------- |
| **Builder API**           | `Command::new()`         | `new CommandBuilder()`          | ✅     | Imperative command construction           |
| **Derive API**            | `#[derive(Parser)]`      | `@Command`                      | ✅     | Decorator-based declarative API           |
| **Subcommands**           | `#[command(subcommand)]` | `Subcommands()` / `@Subcommand` | ✅     | Nested command hierarchies                |
| **Positional Args**       | `#[arg]` (no flags)      | `@Arg` (no short/long)          | ✅     | Inferred from absence of flags            |
| **Named Options**         | `#[arg(short, long)]`    | `@Arg({ short, long })`         | ✅     | Short and long flag support               |
| **Global Arguments**      | `global = true`          | `global: true`                  | ✅     | Propagated to all subcommands             |
| **Aliases**               | `visible_aliases`        | `aliases: []`                   | ✅     | Subcommand aliases                        |
| **Boolean Flags**         | `action = SetTrue`       | `action: ArgAction.SetTrue`     | ✅     | Inferred from `boolean` type              |
| **Auto-Help**             | `-h`, `--help`           | `-h`, `--help`                  | ✅     | Auto-injected, clap-style formatting      |
| **Version Flag**          | `-V`, `--version`        | `-V`, `--version`               | ✅     | Auto-injected when version is set         |
| **Colored Help**          | `color` feature          | ANSI styling                    | ✅     | Yellow headings, green literals           |
| **Environment Variables** | `env = "MY_VAR"`         | `env: "MY_VAR"`                 | ✅     | Fallback when CLI arg not provided        |
| **Default Values**        | `default_value = "x"`    | `default: 'x'`                  | ✅     | Shown in help text                        |
| **Value Validation**      | `value_parser`           | `valueParser: fn`               | ✅     | Custom functions and `"number"` built-in  |
| **Enumerated Values**     | `value_enum`             | `possibleValues: []`            | ✅     | Also `@ValueEnum` decorator               |
| **Collections**           | `Vec<T>`                 | `action: ArgAction.Append`      | ✅     | Inferred from `string[]` type             |
| **Escape Sequence**       | `--`                     | `--`                            | ✅     | All subsequent args treated as positional |
| **Short Clusters**        | `-abc`                   | `-abc`                          | ✅     | Cluster of short flags                    |
| **Attached Values**       | `-n4`, `--name=val`      | `-n4`, `--name=val`             | ✅     | Value attached to flag                    |
| **Conflicts**             | `conflicts_with`         | `conflictsWith: []`             | ✅     | Mutual exclusivity                        |

### ArgAction Support

| Action      | Clap               | Clepo                | Status | Notes                          |
| :---------- | :----------------- | :------------------- | :----- | :----------------------------- |
| `Set`       | Store single value | `ArgAction.Set`      | ✅     | Default for strings/numbers    |
| `Append`    | Collect into Vec   | `ArgAction.Append`   | ✅     | Default for arrays             |
| `SetTrue`   | Store `true`       | `ArgAction.SetTrue`  | ✅     | Default for booleans           |
| `SetFalse`  | Store `false`      | `ArgAction.SetFalse` | ✅     | Explicit opt-in                |
| `Count`     | Increment counter  | `ArgAction.Count`    | ✅     | For `-vvv` style verbosity     |
| `Help`      | Display help       | `ArgAction.Help`     | ✅     | Auto-injected                  |
| `HelpShort` | Display short help | ❌                   | ❌     | Not yet implemented            |
| `HelpLong`  | Display long help  | ❌                   | ❌     | Not yet implemented            |
| `Version`   | Display version    | `ArgAction.Version`  | ✅     | Auto-injected when version set |

### Advanced Features

| Feature                    | Clap                             | Clepo                  | Status | Notes                                 |
| :------------------------- | :------------------------------- | :--------------------- | :----- | :------------------------------------ |
| **Argument Groups**        | `ArgGroup`                       | `group`, `groups: Map` | ⚠️     | Basic support, needs `requires` field |
| **Value Delimiters**       | `value_delimiter = ','`          | ❌                     | ❌     | Parse `--file a,b,c` as array         |
| **Num Args**               | `num_args(1..=3)`                | ❌                     | ❌     | Specify min/max values                |
| **Last Positional**        | `last = true`                    | ❌                     | ❌     | Must come after `--`                  |
| **Trailing Var Arg**       | `trailing_var_arg = true`        | ❌                     | ❌     | Capture all remaining                 |
| **Allow Hyphen Values**    | `allow_hyphen_values = true`     | ❌                     | ❌     | Accept `-1` as value not flag         |
| **Allow Negative Numbers** | `allow_negative_numbers`         | Partial                | ⚠️     | Lexer detects but not configurable    |
| **Hide from Help**         | `hide = true`                    | `hide: true`           | ✅     | Internal args                         |
| **Requires**               | `requires = "other"`             | ❌                     | ❌     | Conditional requirement               |
| **Required If**            | `required_if_eq`                 | ❌                     | ❌     | Conditional requirement               |
| **External Subcommands**   | `allow_external_subcommands`     | ❌                     | ❌     | Treat unknown as subcommand           |
| **Subcommand Precedence**  | `subcommand_precedence_over_arg` | ❌                     | ❌     | Parsing priority                      |
| **Suggestions**            | "Did you mean...?"               | Levenshtein distance   | ✅     | Typo suggestions for flags            |
| **Custom Usage**           | `override_usage`                 | ❌                     | ❌     | Override auto-generated usage         |
| **Shell Completions**      | `clap_complete`                  | ❌                     | ❌     | bash/zsh/fish scripts                 |
| **Man Page Generation**    | `clap_mangen`                    | ❌                     | ❌     | roff format                           |

### Value Parser Types

| Parser               | Clap                        | Clepo                    | Status | Notes                      |
| :------------------- | :-------------------------- | :----------------------- | :----- | :------------------------- |
| **String**           | `String`                    | Default                  | ✅     | No parsing needed          |
| **Number**           | `i64`, `u64`, `f64`         | `valueParser: "number"`  | ✅     | Basic number parsing       |
| **Boolean**          | `bool`                      | `"true"`/`"false"`       | ✅     | Strict parsing             |
| **Boolish**          | `BoolishValueParser`        | `valueParser: "boolish"` | ✅     | yes/no, 1/0, on/off        |
| **Ranged Integer**   | `RangedI64ValueParser`      | `{ ranged: [min, max] }` | ✅     | Validates within bounds    |
| **Non-Empty String** | `NonEmptyStringValueParser` | ❌                       | ❌     | Reject empty strings       |
| **Path**             | `PathBuf`                   | `valueParser: "file"`    | ⚠️     | Placeholder, not validated |
| **Custom Function**  | `Fn(&str) -> Result<T, E>`  | `(val: string) => T`     | ✅     | Full custom parsing        |

### Error Kinds

| Kind                      | Description                             | Status |
| :------------------------ | :-------------------------------------- | :----- |
| `MissingRequiredArgument` | A required argument was not provided    | ✅     |
| `UnknownArgument`         | An unrecognized argument was provided   | ✅     |
| `InvalidArgumentValue`    | An argument's value could not be parsed | ✅     |
| `MissingValue`            | A flag requires a value but none given  | ✅     |
| `UnexpectedArgument`      | An argument in the wrong context        | ✅     |
| `MissingSubcommand`       | A required subcommand was not provided  | ✅     |
| `ArgumentConflict`        | Mutually exclusive arguments were used  | ✅     |
| `Internal`                | A bug in clepo (should be reported)     | ✅     |

---

## Architecture

### Clap's Multi-Crate Structure (Reference)

```
clap (facade)
├── clap_builder (core)
│   ├── builder/   (Command, Arg, ArgGroup, etc.)
│   ├── parser/    (Parser, ArgMatcher, Validator)
│   ├── error/     (Error types, formatting)
│   └── output/    (Help, Usage, Completions)
├── clap_derive (proc macro)
├── clap_lex (tokenizer)
├── clap_complete (shell completions)
└── clap_mangen (man pages)
```

### Clepo's Module Structure

```
clepo
├── mod.ts         (public API facade)
├── command.ts     (CommandBuilder class)
├── arg.ts         (Arg class, ArgAction enum)
├── decorators.ts  (@Command, @Arg, @Subcommand, Subcommands())
├── parser.ts      (Parser, recursive descent)
├── arg_matcher.ts (ArgMatcher, ArgMatches)
├── lexer.ts       (RawArgs, ParsedArg, ShortFlags)
├── help.ts        (HelpGenerator, styling)
├── error.ts       (ClepoError, ErrorKind)
├── reflect.ts     (Metadata management)
├── util.ts        (Levenshtein distance, suggestions)
└── types.ts       (Context, Helper interfaces)
```

### Phase Separation

Following clap's design, clepo separates parsing into distinct phases:

1. **Build Phase**: Decorators attach metadata to classes
2. **Finalize Phase**: `Command.finalize()` propagates globals, injects help/version
3. **Parse Phase**: `Parser.parse()` tokenizes and builds `ArgMatches`
4. **Validate Phase**: Check required args, groups, conflicts
5. **Hydrate Phase**: Apply `ArgMatches` to user class instance

---

## Terminology Alignment

| Concept         | Clap (Rust)             | Clepo (TS)       | Definition                                     |
| :-------------- | :---------------------- | :--------------- | :--------------------------------------------- |
| **Command**     | `Command`               | `CommandBuilder` | Application or subcommand (builder API)        |
| **Arg**         | `Arg`                   | `Arg`            | Single CLI argument (flag, option, positional) |
| **Parser**      | `#[derive(Parser)]`     | `@Command`       | Main entry point decorator                     |
| **Subcommand**  | `#[derive(Subcommand)]` | `Subcommands()`  | Enum of subcommand variants                    |
| **ArgAction**   | `ArgAction`             | `ArgAction`      | Behavior when arg is encountered               |
| **ValueParser** | `ValueParser`           | `valueParser`    | Validation and type conversion                 |
| **ArgGroup**    | `ArgGroup`              | `ArgGroup`       | Relationships between args                     |
| **ArgMatches**  | `ArgMatches`            | `ArgMatches`     | Parsed result container                        |

---

## Deno-Specific Considerations

### Decorator Strategy

TypeScript's `experimentalDecorators` is deprecated in favor of TC39 Stage 3
decorators. clepo supports both with the following priority:

1. **Prefer `Symbol.metadata`** (TC39 standard) when available
2. **Fall back to `Reflect.getMetadata`** (legacy) when not
3. **Always support explicit `type` config** as an override
4. **Use default values** to infer types when possible

### Best Practices Applied

- ✅ Bare specifiers via `deno.json` imports
- ✅ JSR-compatible module structure
- ✅ `@std/` packages instead of `deno.land/std` URLs
- ✅ Strict TypeScript mode
- ✅ Zero lint errors
- ✅ Comprehensive test coverage (72 tests)

---

## Roadmap

### v0.4.x (Completed)

- [x] Fix metadata lookup bug
- [x] Auto-inject help/version args
- [x] Comprehensive test suite
- [x] Research TC39 decorators, macros, and alternatives
- [x] Add modern Deno linting rules
- [x] Add explicit `type` option to `@Arg` decorator
- [x] Add value parsers (boolish, ranged)
- [x] Implement "Did you mean...?" suggestions
- [x] `hide` option for internal args

### v0.5.0 (Current) ✅

- [x] Clap-like `Subcommands()` factory function
- [x] Auto-detection of subcommand properties
- [x] Union type inference for subcommands
- [x] Rename `CommandDecorator` to `Command`
- [x] Rename `Command` to `CommandBuilder`
- [x] Improved error messages with context
- [x] New error kinds: `MissingSubcommand`, `ArgumentConflict`
- [x] Comprehensive test suite (72 tests)
- [x] Updated documentation

### v0.6.0 (Next)

- [ ] Implement hybrid decorator detection (`Symbol.metadata` + `Reflect.getMetadata`)
- [ ] `num_args` - specify value count range
- [ ] `value_delimiter` - comma-separated values
- [ ] `trailing_var_arg` - capture all remaining
- [ ] `requires` - conditional requirements

### v0.7.0 (Polish)

- [ ] Help subcommand (`myapp help subcommand`)
- [ ] `HelpShort` / `HelpLong` actions
- [ ] Custom usage string override
- [ ] `args_override_self` setting

### v1.0.0 (Production Ready)

- [ ] Shell completion generation
- [ ] Comprehensive documentation
- [ ] Performance benchmarks
- [ ] Full TC39 decorator support with `Symbol.metadata`

### Future (Post-1.0)

- [ ] Man page generation
- [ ] i18n support
- [ ] WASM support

---

## API Examples

### Decorator API (Recommended)

```typescript
import { Arg, ArgAction, Cli, Command, Subcommands } from "@loru/clepo";

// Subcommand definition
@Command({ about: "Add files to staging" })
class AddCmd {
  @Arg({ required: true, action: ArgAction.Append })
  files!: string[];

  @Arg({ short: "f", long: true, help: "Force add" })
  force: boolean = false;

  async run() {
    console.log(`Adding ${this.files.length} files, force=${this.force}`);
  }
}

// Create subcommand "enum" - just like Rust!
const Commands = Subcommands(AddCmd);

@Command({
  name: "git",
  version: "2.40.0",
  about: "A stupid content tracker",
})
class Git {
  @Arg({ short: "v", long: true, action: ArgAction.Count, global: true })
  verbose = 0;

  // Type is automatically AddCmd
  command = Commands;

  async run() {
    console.log(`Verbosity: ${this.verbose}`);
  }
}

await Cli.run(Git);
```

### Builder API

```typescript
import { ArgAction, ArgBuilder, CommandBuilder } from "@loru/clepo";

class GitInstance {
  verbose = 0;
  async run() {
    console.log(`Verbosity: ${this.verbose}`);
  }
}

const git = new CommandBuilder("git")
  .setVersion("2.40.0")
  .setAbout("A stupid content tracker")
  .addArg(
    new ArgBuilder({
      id: "verbose",
      short: "v",
      long: "verbose",
      action: ArgAction.Count,
      global: true,
    }),
  );

git.cls = GitInstance;
await git.run();
```

### Value Parsers

```typescript
import { Arg, Cli, Command } from "@loru/clepo";

@Command({ name: "config", version: "1.0.0" })
class ConfigCmd {
  @Arg({ long: "port", valueParser: "number" })
  port: number = 8080;

  @Arg({ long: "debug", valueParser: "boolish" })
  debug = false;

  @Arg({ long: "threads", valueParser: { ranged: [1, 64] } })
  threads = 4;

  @Arg({
    long: "date",
    valueParser: (val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) throw new Error("Invalid date format");
      return d;
    },
  })
  date?: Date;

  async run() {
    console.log(`Port: ${this.port}, Debug: ${this.debug}`);
  }
}

await Cli.run(ConfigCmd);
```

### Error Handling

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
      case ErrorKind.MissingSubcommand:
        console.error("Missing subcommand:", e.message);
        break;
      default:
        console.error("Error:", e.message);
    }
  }
}
```

---

## Testing

```bash
# Run all tests
deno test tests/ --allow-read --allow-env

# Type check
deno check mod.ts

# Lint
deno lint

# Format
deno fmt

# Run all checks
deno task all
```

Current test coverage: 72 tests covering all major features.

---

## Contributing

1. Follow clap's patterns where applicable
2. Maintain phase separation (build → finalize → parse → validate → hydrate)
3. All code must pass `deno lint` and `deno check`
4. Add tests for new features
5. Update PLAN.md and RELEASE_NOTES.md as needed
