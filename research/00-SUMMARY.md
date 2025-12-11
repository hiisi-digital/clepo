# Research Summary: Metaprogramming Alternatives for clepo

**Last Updated:** January 2025

## Executive Summary

After extensive research into TypeScript, Deno, TC39 proposals, and alternative metaprogramming approaches, the conclusion is clear:

**Decorators are the only viable path for clepo's annotation-based CLI definition.**

There are no first-class attributes, macros, or alternative annotation systems in the TypeScript/Deno ecosystem. The TC39 decorator standard (Stage 3) with Decorator Metadata is the future, and `experimentalDecorators` + `emitDecoratorMetadata` is the legacy approach still widely used.

## Research Files

| # | File | Topic | Key Finding |
|---|------|-------|-------------|
| 01 | `01-tc39-proposals.md` | TC39 Proposals Overview | No alternative to decorators in TC39 pipeline |
| 02 | `02-typescript-roadmap.md` | TypeScript Roadmap | No macros/attributes planned; decorators are the path |
| 03 | `03-tc39-decorators-proposal.md` | TC39 Decorators (Stage 3) | New standard; `accessor` keyword; no auto-type info |
| 04 | `04-deno-2.0-announcement.md` | Deno 2.0 | Both decorator flavors supported; no alternatives |
| 05 | `05-tc39-decorator-metadata.md` | Decorator Metadata (Stage 3) | `Symbol.metadata` replaces `Reflect.getMetadata` |
| 06 | `06-typescript-5.2-release.md` | TypeScript 5.2 Release | Decorator Metadata implementation details |
| 07 | `07-typescript-design-goals.md` | TypeScript Design Goals | No runtime types by design; "fully erasable" types |
| 08 | `08-bun-macros.md` | Bun Macros | Bun-only; bundle-time, not decorator alternative |
| 09 | `09-babel-plugin-macros.md` | Babel Macros | Babel-only; not suitable for Deno |

## Key Findings

### 1. No First-Class Attributes Coming

Neither TC39 nor TypeScript have plans for C#-style attributes or Java-style annotations.

**Why?** TypeScript's design philosophy is "fully erasable types" - all type information is removed at compile time. Runtime metadata violates this principle.

### 2. No Macro System Coming

Neither TC39 nor TypeScript have macro proposals.

**Why?** JavaScript's dynamic runtime nature makes compile-time macros challenging. TypeScript explicitly avoids "emit different code based on the results of the type system."

**Alternatives exist but aren't suitable:**
- **Bun Macros**: Bun-only, bundle-time value computation (not decoration)
- **Babel Macros**: Requires Babel, doesn't work with Deno

### 3. TC39 Decorators Are the Standard

The TC39 Decorator proposal (Stage 3) is implemented in TypeScript 5.0+ and is the future:

```typescript
// New TC39 decorators (TypeScript 5.0+)
function MyDecorator(value: any, context: ClassFieldDecoratorContext) {
  // context.name, context.kind, context.static, context.private
  // context.metadata (from Decorator Metadata proposal)
  // context.addInitializer()
  return (initialValue) => initialValue;
}
```

### 4. No Automatic Type Information

**Critical limitation:** TC39 decorators do NOT provide automatic type information.

| Feature | `emitDecoratorMetadata` | TC39 + Decorator Metadata |
|---------|------------------------|---------------------------|
| Automatic `design:type` | ✅ Yes | ❌ No |
| Access method | `Reflect.getMetadata()` | `Symbol.metadata` |
| Standardized | ❌ No (TS-only) | ✅ Yes (TC39 Stage 3) |
| Future-proof | ❌ Deprecated | ✅ The standard |

### 5. Ecosystem Status

| Framework/Library | Current Approach | TC39 Migration |
|-------------------|------------------|----------------|
| NestJS | `experimentalDecorators` | Not yet |
| TypeORM | `experimentalDecorators` | Not yet |
| class-validator | `experimentalDecorators` | Not yet |
| Angular | `experimentalDecorators` | In progress |
| Lit | TC39 decorators | ✅ Complete |

The ecosystem is still in transition. Most major frameworks still use legacy decorators.

## Recommendations for clepo

### Immediate (v0.4.x)

1. **Keep using `experimentalDecorators`** - It works, ecosystem uses it
2. **Add explicit `type` option to `@Arg`** - Future-proofs against metadata loss

```typescript
@Arg({ type: 'string' })  // Explicit, works with any decorator system
name!: string;
```

### Short-term (v0.5.x)

1. **Implement hybrid detection** - Support both decorator systems
2. **Prefer `Symbol.metadata`** - When available, use TC39 standard
3. **Fall back to `Reflect.getMetadata`** - For legacy decorator users

```typescript
function getCommandMetadata(Class: new () => unknown) {
  // TC39 approach (preferred)
  if (Symbol.metadata && Class[Symbol.metadata]) {
    return Class[Symbol.metadata];
  }
  // Legacy approach (fallback)
  if (typeof Reflect !== 'undefined' && Reflect.getMetadata) {
    return {
      args: Reflect.getMetadata('args', Class) ?? [],
      options: Reflect.getMetadata('options', Class) ?? [],
    };
  }
  throw new Error('No metadata available');
}
```

### Long-term (v1.0+)

1. **Consider `accessor` keyword** - Enables type inference from defaults
2. **Watch ecosystem migration** - Follow when NestJS/TypeORM move
3. **Potentially deprecate legacy support** - Once ecosystem has moved

```typescript
// Future pattern with accessor + default inference
class MyCommand {
  @Arg()
  accessor name = "";  // Infer string from default

  @Arg()
  accessor count = 0;  // Infer number from default

  @Arg()
  accessor verbose = false;  // Infer boolean from default
}
```

## What NOT to Pursue

1. **Bun Macros** - Bun-only, wrong use case (bundle-time, not decoration)
2. **Babel Macros** - Requires Babel, breaks Deno's zero-config philosophy
3. **Custom build step** - Adds complexity, hurts DX
4. **Waiting for "better" solution** - Nothing is coming; decorators are it

## Sources

All research is based on official sources:

- TC39 Proposals: https://github.com/tc39/proposals
- TC39 Decorators: https://github.com/tc39/proposal-decorators
- TC39 Decorator Metadata: https://github.com/tc39/proposal-decorator-metadata
- TypeScript Roadmap: https://github.com/microsoft/TypeScript/wiki/Roadmap
- TypeScript Design Goals: https://github.com/Microsoft/TypeScript/wiki/TypeScript-Design-Goals
- TypeScript 5.2 Release: https://devblogs.microsoft.com/typescript/announcing-typescript-5-2/
- Deno 2.0: https://deno.com/blog/v2.0
- Bun Macros: https://bun.sh/docs/bundler/macros
- Babel Plugin Macros: https://github.com/kentcdodds/babel-plugin-macros

## Conclusion

**The hybrid approach is the right path for clepo:**

1. Support TC39 decorators with `Symbol.metadata` (future standard)
2. Fall back to legacy `experimentalDecorators` + `emitDecoratorMetadata`
3. Always allow explicit `type` configuration as an override
4. Use default values to infer types when possible

This approach:
- ✅ Works today with existing ecosystem
- ✅ Is forward-compatible with TC39 standards
- ✅ Follows TypeScript's design philosophy
- ✅ Provides good DX for clepo users
- ✅ Aligns with how major frameworks will eventually migrate
