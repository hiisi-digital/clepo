# TypeScript Roadmap Research Summary

**Source:** https://github.com/microsoft/TypeScript/wiki/Roadmap
**Fetched:** January 2025

## Overview

The TypeScript roadmap documents past, current, and future features. This research focuses on features relevant to clepo's metadata/annotation needs.

## Key "Future" Items (Planned but Unscheduled)

- **Investigate nominal typing support** - Could provide runtime type discrimination
- **Flattening declarations** - Improved `.d.ts` output
- **Implement ES Decorator proposal** - Already done in 5.0
- **Investigate Ambient, Deprecated, and Conditional decorators** - Additional decorator types
- **Investigate partial type argument inference** - Quality of life improvement
- **Decorators for function expressions/arrow functions** - Currently decorators only work on classes/methods/properties

## Notable Absences

### No First-Class Attributes
TypeScript has no plans for C#-style attributes. Decorators are the intended mechanism for metadata attachment.

### No Macro System
There is no macro or compile-time code generation system on the roadmap. TypeScript's philosophy is to be a superset of JavaScript, not a separate language with metaprogramming.

### No Runtime Type Information
TypeScript explicitly does not emit runtime type information (except through the deprecated `emitDecoratorMetadata`). This is by design - types are erased at compile time.

## Key Historical Releases

### TypeScript 5.0 (March 2023)
- **Standard ECMAScript Decorators** - The new TC39 decorator standard
- `const` Type Parameters
- `--moduleResolution bundler`
- `--verbatimModuleSyntax`

### TypeScript 5.2 (August 2023) - NOT ON THIS PAGE
Note: The roadmap page hasn't been updated since Feb 2023, so 5.2+ features (including Decorator Metadata) aren't listed here. Need to check release notes separately.

### TypeScript 4.x Highlights
- 4.9: `satisfies` operator, auto-accessors
- 4.1: Template literal types, recursive conditional types
- 4.0: Variadic tuple types

### TypeScript 1.5 (2015) - Decorator Origins
- Support for ES7 Decorators proposal
- **Support for Decorator type metadata** (`emitDecoratorMetadata`)

## Implications for clepo

1. **Decorators are the official path** - No alternative annotation mechanism is planned
2. **No macros coming** - Build-time transformations won't be built into TypeScript
3. **No runtime types** - TypeScript philosophy explicitly excludes runtime type emission
4. **Arrow function decorators** - May come in the future, could be useful for clepo's callbacks
5. **The roadmap is outdated** - Last updated Feb 2023, need to check release notes for 5.2+ features

## Need Additional Research

- TypeScript 5.2 Release Notes (Decorator Metadata)
- TypeScript 5.3+ Release Notes
- TypeScript Design Principles/Goals
