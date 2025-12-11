# TypeScript Design Goals Research Summary

**Source:** https://github.com/Microsoft/TypeScript/wiki/TypeScript-Design-Goals
**Fetched:** January 2025

## Overview

This official document outlines the core design principles that guide TypeScript's development. Understanding these principles is crucial for clepo because they explain **why** TypeScript doesn't have (and won't have) certain features like runtime types or macros.

## Goals

1. **Statically identify constructs that are likely to be errors** - Type checking at compile time
2. **Provide a structuring mechanism for larger pieces of code** - Modules, namespaces, classes
3. **Impose no runtime overhead on emitted programs** - Types are erased
4. **Emit clean, idiomatic, recognizable JavaScript code** - Output should look handwritten
5. **Produce a language that is composable and easy to reason about**
6. **Align with current and future ECMAScript proposals** - Follow TC39
7. **Preserve runtime behavior of all JavaScript code** - Don't change JS semantics
8. **Avoid adding expression-level syntax** - Minimal new syntax
9. **Use a consistent, fully erasable, structural type system** - Types disappear at runtime
10. **Be a cross-platform development tool**
11. **Do not cause substantial breaking changes from TypeScript 1.0**

## Non-Goals (Critical for clepo!)

### "Add or rely on run-time type information in programs"

> "Add or rely on run-time type information in programs, or emit different code based on the results of the type system. Instead, encourage programming patterns that do not require run-time metadata."

This is the key non-goal for clepo. TypeScript explicitly **will not**:
- Emit runtime type information
- Provide reflection capabilities
- Make types available at runtime

This is why `emitDecoratorMetadata` is deprecated and won't be replaced with a better alternative.

### Other Relevant Non-Goals

- **"Exactly mimic the design of existing languages"** - Won't add C#-style attributes just because C# has them
- **"Provide additional runtime functionality or libraries"** - Won't add a reflect-metadata equivalent to the language
- **"Apply a sound or 'provably correct' type system"** - Pragmatism over purity

## Key Principle: "Fully Erasable"

The phrase "fully erasable, structural type system" means:
- All type annotations can be removed without changing runtime behavior
- The JavaScript output is completely independent of types
- No runtime code is generated based on types

This is fundamentally different from languages like:
- **C#** - Attributes exist at runtime via reflection
- **Java** - Annotations can be retained at runtime
- **Python** - Type hints can be inspected via `typing.get_type_hints()`

## Implications for clepo

### What This Means

1. **No automatic type information ever** - TypeScript will never provide automatic runtime types
2. **Decorators are the only path** - TC39 decorators with explicit metadata is the standard
3. **Don't expect reflection** - TypeScript won't add C#/Java-style reflection
4. **`emitDecoratorMetadata` is an anomaly** - It violated design goals and won't be expanded

### Strategies That Align with TS Goals

1. **Explicit type configuration** - Require users to specify types in decorator config
2. **Default value inference** - Use JavaScript runtime values to infer types
3. **Code generation** - External tools that generate type info (like Prisma, tRPC)
4. **Build-time transforms** - Babel plugins, SWC transforms that inject metadata

### Strategies That Fight TS Goals (Avoid)

1. Relying on `emitDecoratorMetadata` long-term
2. Expecting TypeScript to add runtime type emission
3. Hoping for a macro system in TypeScript
4. Waiting for C#-style attributes

## Alternative Approaches in the Ecosystem

Since TypeScript won't provide runtime types, the ecosystem has developed alternatives:

### Build-Time Code Generation
- **Prisma** - Generates TypeScript from schema files
- **tRPC** - Infers types from runtime code
- **Zod** - Runtime schemas that infer TypeScript types

### Runtime Schemas with Type Inference
```typescript
// Zod approach - define runtime, infer types
const UserSchema = z.object({
  name: z.string(),
  age: z.number()
});
type User = z.infer<typeof UserSchema>;
```

### Explicit Type Registration
```typescript
// TypeDI, InversifyJS approach
@Injectable()
class MyService {
  constructor(@Inject(TYPES.Logger) logger: Logger) {}
}
```

## Conclusion for clepo

TypeScript's design philosophy confirms that:

1. **Decorators + explicit config is the right path** - Aligns with TS goals
2. **Don't rely on deprecated features** - `emitDecoratorMetadata` is an exception to TS goals
3. **Consider Zod-style approach** - Runtime-first with type inference
4. **Explicit is better than implicit** - Matches TypeScript's philosophy

The hybrid approach (TC39 decorators + explicit type config + fallback to legacy) is well-aligned with TypeScript's design principles.
