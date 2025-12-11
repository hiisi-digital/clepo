# clepo Codebase Analysis

> **Version**: 0.4.0
> **Last Updated**: Post-refactor with comprehensive clap reference analysis

---

## 1. Architecture Overview

### 1.1 Design Philosophy

clepo is a TypeScript port of Rust's `clap` crate, following its core design
principles:

1. **Two-API Model**: Both Builder (imperative) and Decorator (declarative) APIs
2. **Phase Separation**: Distinct build → finalize → parse → validate → hydrate phases
3. **ArgMatches Abstraction**: Separates parsing from user class hydration
4. **Recursive Descent Parsing**: Proper subcommand handling without lookahead

### 1.2 Module Structure

```
clepo/
├── mod.ts           # Public API facade
├── command.ts       # Command builder class, CommandSettings
├── arg.ts           # Arg class, ArgAction enum
├── arg_matcher.ts   # ArgMatcher (mutable), ArgMatches (immutable)
├── decorators.ts    # @CommandDecorator, @Arg, @Subcommand, @ValueEnum
├── parser.ts        # Recursive descent parser
├── lexer.ts         # RawArgs, ParsedArg, ShortFlags (clap_lex equivalent)
├── help.ts          # HelpGenerator with ANSI styling
├── error.ts         # ClepoError, ErrorKind enum
├── reflect.ts       # Metadata storage/retrieval singleton
└── types.ts         # Context, Helper interfaces
```

### 1.3 Comparison with Clap's Structure

| Clap Crate      | clepo Equivalent                         | Notes                                |
| :-------------- | :--------------------------------------- | :----------------------------------- |
| `clap`          | `mod.ts`                                 | Facade re-exporting public API       |
| `clap_builder`  | `command.ts`, `arg.ts`, `arg_matcher.ts` | Core builder components              |
| `clap_derive`   | `decorators.ts`                          | Decorator-based API (vs proc macros) |
| `clap_lex`      | `lexer.ts`                               | Tokenization layer                   |
| `clap_complete` | ❌ Not implemented                       | Shell completion generation          |
| `clap_mangen`   | ❌ Not implemented                       | Man page generation                  |

---

## 2. Parsing Architecture

### 2.1 Phase Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BUILD PHASE                                     │
│  Decorators execute on class definition, storing metadata via reflect.ts     │
│  @CommandDecorator → reflect.setCommand()                                    │
│  @Arg → reflect.addArg()                                                     │
│  @Subcommand → reflect.addSubcommand()                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FINALIZE PHASE                                    │
│  Command.finalize() called once before parsing                               │
│  - Propagates global args to subcommands                                     │
│  - Injects built-in -h/--help and -V/--version args                          │
│  - Populates argument groups from individual arg declarations                │
│  - Propagates version if PropagateVersion setting enabled                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PARSE PHASE                                     │
│  Parser.parse() - Recursive descent through command tree                     │
│  - Lexer tokenizes raw args (RawArgs → ParsedArg)                            │
│  - Parser matches tokens against arg definitions                             │
│  - ArgMatcher accumulates matches (mutable)                                  │
│  - On subcommand match, recurses with new ArgMatcher                         │
│  - Fills defaults and env values after parsing each level                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VALIDATE PHASE                                    │
│  Parser.validate() - Recursive validation                                    │
│  - Required arguments check                                                  │
│  - Argument groups (XOR/AND relationships)                                   │
│  - Conflicts between arguments                                               │
│  - Subcommand required check                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HYDRATE PHASE                                    │
│  Parser.hydrate() - Populate user class instances                            │
│  - Creates instances of command classes                                      │
│  - Applies ArgMatches values to instance properties                          │
│  - Recursively hydrates subcommand instances                                 │
│  - Injects subcommand instance into parent's subcommand property             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Lexer Design (clap_lex Equivalent)

The lexer in `lexer.ts` follows clap_lex's design principles:

```typescript
// RawArgs: Cursor-based container
class RawArgs {
  next(cursor: ArgCursor): ParsedArg | undefined;
  peek(cursor: ArgCursor): ParsedArg | undefined;
  remaining(cursor: ArgCursor): string[];
}

// ParsedArg: Query methods for token classification
class ParsedArg {
  isLong(): boolean; // --flag or --flag=value
  toLong(): [string, string | undefined] | undefined;
  isShort(): boolean; // -f or -abc
  toShort(): ShortFlags | undefined;
  isEscape(): boolean; // --
  isStdio(): boolean; // -
  isNegativeNumber(): boolean;
  toValue(): string;
}

// ShortFlags: Iterator for -abc clusters
class ShortFlags {
  nextFlag(): string | undefined;
  nextValue(): string | undefined;
  isNegativeNumber(): boolean;
}
```

### 2.3 Parser State Machine

Unlike the old broken implementation that pre-scanned for subcommands, the
current parser:

1. **Parses linearly** - No lookahead or pre-scanning
2. **Context-sensitive** - Interpretation depends on current command's arg defs
3. **Recursive** - Subcommand match triggers recursion with new matcher
4. **Early exit** - Help/Version actions checked before validation

```typescript
// Simplified parse loop
while (token = rawArgs.peek(cursor)) {
  if (!trailingValues && isSubcommand(token)) {
    recurse(subcommand, newMatcher);
    return;
  }
  if (token.isEscape()) { trailingValues = true; continue; }
  if (token.isLong()) { parseLong(...); continue; }
  if (token.isShort()) { parseShort(...); continue; }
  parsePositional(...);
}
fillDefaultsAndEnv(...);
```

---

## 3. Comparison with Clap

### 3.1 What We Got Right

| Aspect                 | Status | Notes                                           |
| :--------------------- | :----- | :---------------------------------------------- |
| Recursive descent      | ✅     | Proper linear parsing without lookahead         |
| ArgMatches abstraction | ✅     | Clean separation of parse result from hydration |
| Phase separation       | ✅     | Build → Finalize → Parse → Validate → Hydrate   |
| Auto help/version      | ✅     | Injected based on CommandSettings               |
| Short flag clusters    | ✅     | `-abc` handled correctly                        |
| Attached values        | ✅     | `--flag=value` and `-fvalue` work               |
| Escape sequence        | ✅     | `--` makes all subsequent positional            |
| Global args            | ✅     | Propagated to subcommands during finalize       |
| Environment fallback   | ✅     | Checked when CLI arg not provided               |

### 3.2 What Clap Does Better

| Feature                      | Clap                               | clepo                         | Gap                        |
| :--------------------------- | :--------------------------------- | :---------------------------- | :------------------------- |
| **Value Parser System**      | TypedValueParser trait with .map() | Simple function or `"number"` | Need more built-in parsers |
| **ArgAction Variants**       | Help, HelpShort, HelpLong          | Only Help                     | Missing granularity        |
| **Num Args**                 | `num_args(1..=3)` range syntax     | Not implemented               | Major feature gap          |
| **Value Delimiter**          | `value_delimiter = ','`            | Not implemented               | Common use case missing    |
| **Error Suggestions**        | "Did you mean...?" with distance   | Not implemented               | UX improvement needed      |
| **Negative Numbers**         | `allow_negative_numbers` option    | Lexer detects but not exposed | API gap                    |
| **Conditional Requirements** | `requires`, `required_if_eq`       | Only `conflictsWith`          | Partial implementation     |

### 3.3 Architectural Differences

| Aspect               | Clap                            | clepo                             |
| :------------------- | :------------------------------ | :-------------------------------- |
| **Derive mechanism** | Proc macro at compile time      | Decorators at runtime             |
| **Type inference**   | Compile-time from Rust types    | Runtime via reflect-metadata      |
| **Memory model**     | Zero-copy string handling       | JavaScript string semantics       |
| **Error handling**   | Rich Error type with formatting | Simpler ClepoError with ErrorKind |
| **Performance**      | Zero-cost abstractions          | Runtime reflection overhead       |

---

## 4. Deno-Specific Considerations

### 4.1 Decorator Status

The TypeScript `experimentalDecorators` option is officially deprecated. The
TC39 Stage 3 decorators are the future, but:

1. **No `emitDecoratorMetadata`**: TC39 decorators don't emit design:type
2. **We depend on type inference**: Arg types are inferred from property types
3. **No migration path**: Until ecosystem adopts TC39 + metadata alternative

**Current Status**: We continue using `experimentalDecorators` and emit a
warning. This is the same situation as all decorator-heavy TypeScript libraries
(TypeORM, NestJS, class-validator, etc.).

**Future Options**:

- Explicit type specification in decorator config
- Build-time code generation (like clap's proc macro)
- Wait for community-standard metadata solution

### 4.2 No JIT Compiler Hints

Unlike Rust's attributes:

- `#[inline]` / `#[inline(always)]` - No equivalent, V8 decides
- `#[cold]` - No equivalent, V8 uses runtime profiling
- `#[must_use]` - TypeScript has no equivalent

V8's adaptive optimization handles these automatically based on runtime behavior.

### 4.3 Modern Deno Patterns Applied

| Pattern           | Status | Notes                                     |
| :---------------- | :----- | :---------------------------------------- |
| Bare specifiers   | ✅     | `"@std/fmt"` in deno.json imports         |
| Type imports      | ✅     | `import type { X }` for types-only        |
| JSR-compatible    | ✅     | Module structure suitable for JSR publish |
| Strict TypeScript | ✅     | Deno's default strict mode                |
| No `any` leakage  | ✅     | Minimal `any` usage, properly typed       |
| Lint clean        | ✅     | Zero deno lint errors                     |

---

## 5. Known Limitations

### 5.1 Compared to Clap

1. **No shell completions**: `clap_complete` equivalent not implemented
2. **No man pages**: `clap_mangen` equivalent not implemented
3. **Limited value parsers**: Only string, number, custom function
4. **No "Did you mean?"**: Levenshtein distance suggestions not implemented
5. **No value delimiter**: Can't do `--file a,b,c`
6. **No num_args**: Can't specify value count ranges
7. **No conditional requirements**: Only conflicts, not `requires`

### 5.2 TypeScript/Deno Specific

1. **Runtime reflection overhead**: Decorators execute at module load
2. **Deprecated decorator syntax**: Using experimentalDecorators
3. **No compile-time validation**: Unlike Rust's type system guarantees
4. **String-based metadata keys**: Less type-safe than Rust's traits

---

## 6. Code Quality Assessment

### 6.1 Strengths

- **Clean module boundaries**: Single responsibility per file
- **Consistent naming**: Follows clap terminology
- **Comprehensive tests**: 47 integration tests
- **Zero lint errors**: Passes deno lint
- **Type-safe**: Minimal `any` usage
- **Well-documented**: JSDoc on public APIs
- **Explicit return types**: All functions have explicit return types
- **Tagged TODOs**: All TODOs reference issues for tracking
- **Modern linting**: Strict Deno lint rules enabled
- **Consistent formatting**: Automated via `deno fmt`
- **Structured errors**: ClepoError with ErrorKind

### 6.2 Potential Improvements

| Area               | Current                 | Improvement                          |
| :----------------- | :---------------------- | :----------------------------------- |
| Debug logging      | `console.log` with flag | Use debug library or structured logs |
| Error messages     | Basic strings           | Rich formatting like clap            |
| Help customization | Limited                 | Theming, custom formatters           |
| Performance        | Not measured            | Add benchmarks                       |

---

## 7. Test Coverage Summary

| Category              |  Tests | Coverage                                    |
| :-------------------- | -----: | :------------------------------------------ |
| Decorator API         |      2 | Subcommands, global flags, clusters         |
| Builder API           |      1 | Mirror of decorator test                    |
| Help/Version          |      6 | Flag detection, no-version case, formatting |
| Environment Variables |      2 | Fallback, CLI precedence                    |
| Value Parsing         |      4 | Number, invalid, custom, custom error       |
| Possible Values       |      2 | Valid, invalid                              |
| Error Handling        |      5 | Unknown, missing required, error kinds      |
| Default Values        |      2 | Used, overridden                            |
| Long Flag Variations  |      2 | `--flag=val`, `--flag val`                  |
| Short Flag Variations |      2 | `-f val`, `-fval`                           |
| Type Inference        |      4 | Number, boolean, array, explicit type       |
| Escape Sequence       |      1 | `--` handling                               |
| Command Settings      |      1 | SubcommandRequired                          |
| **Total**             | **47** |                                             |

---

## 8. Future Directions

> **Note:** See `/research/00-SUMMARY.md` for comprehensive research on TC39
> decorators, macros, and alternative metaprogramming approaches.

### 8.1 Short Term (v0.4.x)

- Add more value parser types (boolish, ranged integers)
- Implement "Did you mean...?" suggestions
- Add `hide` option for internal args

### 8.2 Medium Term (v0.5-0.6)

- `num_args` for value count ranges
- `value_delimiter` for comma-separated values
- `requires` for conditional requirements
- Help subcommand (`myapp help subcmd`)

### 8.3 Long Term (v1.0+)

- Shell completion generation
- Man page generation
- TC39 decorator support (when ecosystem ready)
- Performance benchmarks and optimization

---

## 9. References

- [clap Documentation](https://docs.rs/clap/latest/clap/)
- [clap_lex Source](https://github.com/clap-rs/clap/tree/master/clap_lex)
- [Deno TypeScript Configuration](https://docs.deno.com/runtime/reference/ts_config_migration/)
- [TC39 Decorators Proposal](https://github.com/tc39/proposal-decorators)
