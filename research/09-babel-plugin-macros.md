# Babel Plugin Macros Research Summary

**Source:** https://github.com/kentcdodds/babel-plugin-macros
**Stars:** 2.6k
**Used By:** 12.7 million projects
**Fetched:** January 2025

## Overview

`babel-plugin-macros` is a popular Babel plugin that allows compile-time code transformation without requiring individual babel plugin configuration. It provides a standard interface for libraries to perform compile-time optimizations.

## Key Concept

Macros are functions that run at compile-time and transform code. The result is inlined directly into the bundle, eliminating runtime overhead.

### Usage Pattern

```javascript
import preval from 'preval.macro'

// This runs at compile-time:
const answer = preval`7 * 6`
// After compilation:
const answer = 42
```

### Import Syntax

Macros are identified by the `.macro` suffix in imports:

```javascript
import myMacro from 'my-library/macro'
// or
import myMacro from 'my-library.macro'
```

## Why It Exists

Many libraries benefit from compile-time transformation:
- **CSS-in-JS**: Generate class names at build time instead of runtime
- **GraphQL**: Compile queries into objects (no runtime parser needed)
- **Preval**: Evaluate expressions at build time

Without macros, each library would need its own Babel plugin and config entry.

## Advantages Over Individual Babel Plugins

1. **Single config entry** - Add `babel-plugin-macros` once, use any macro
2. **Explicit imports** - Clear which code runs at compile time
3. **User-controlled ordering** - Import order determines execution order
4. **Better error messages** - Misconfiguration caught at compile time
5. **Tooling support** - Create React App includes it by default

## AST Node Types Supported

Macros can work with any AST node type:

```javascript
// Tagged template literal
const val = macro`expression`

// Function call
const val = macro('expression')

// JSX element
const val = <Macro>expression</Macro>
```

## Limitations

1. **Requires Babel** - Not available in esbuild, SWC, or native TypeScript
2. **Not for implicit transforms** - Must be explicitly imported
3. **Cache issues** - Impure macros (with side effects) can have stale results
4. **No native Deno support** - Would need Deno to use Babel

## Common Use Cases

- **preval.macro** - Evaluate expressions at compile time
- **codegen.macro** - Generate code at compile time
- **graphql.macro** - Compile GraphQL queries
- **css.macro** - CSS-in-JS compile-time optimization
- **idx.macro** - Safe deep property access

## Relevance for clepo

### Could We Use Babel Macros?

**Theoretically possible but not ideal because:**

1. **Deno doesn't use Babel** - Deno has its own TypeScript compiler
2. **Would require build step** - Breaks Deno's "just run" philosophy
3. **Loss of decorator ergonomics** - Macros use function calls, not decorator syntax
4. **Ecosystem fragmentation** - Node users would need Babel, Deno wouldn't

### What We Could Learn

1. **Explicit is better** - Macros are explicit about compile-time behavior
2. **Import syntax matters** - Special import patterns identify transformations
3. **AST manipulation patterns** - How to transform code at compile time

## Comparison with Bun Macros

| Feature | Babel Macros | Bun Macros |
|---------|--------------|------------|
| Runtime | Any with Babel | Bun only |
| Syntax | `.macro` import | `with { type: "macro" }` |
| Config | `.babelrc` entry | None needed |
| Result | AST transformation | Value inlining |
| TypeScript | Via Babel preset | Native |

## Conclusion for clepo

Babel macros are not a good fit for clepo because:

1. Deno doesn't use Babel
2. Would break Deno's zero-config philosophy
3. Decorators provide better ergonomics for CLI definition
4. Would fragment the ecosystem

However, the concept confirms that **compile-time code transformation is valuable** and widely used. The lack of a macro system in TypeScript/Deno reinforces that **decorators are the right path** for clepo's metaprogramming needs.
