# TC39 Decorator Metadata Proposal Research Summary

**Source:** https://github.com/tc39/proposal-decorator-metadata
**Stage:** 3
**Fetched:** January 2025

## Overview

The Decorator Metadata proposal extends the TC39 Decorators proposal by adding the ability for decorators to associate **metadata** with decorated values. This is the replacement for TypeScript's `emitDecoratorMetadata` feature.

## Key Concepts

### The `context.metadata` Object

Every decorator receives a shared `metadata` object via the context argument:

```typescript
type Decorator = (value: Input, context: {
  kind: string;
  name: string | symbol;
  access: { get?(): unknown; set?(value: unknown): void; };
  isPrivate?: boolean;
  isStatic?: boolean;
  addInitializer?(initializer: () => void): void;
  metadata?: Record<string | number | symbol, unknown>;  // NEW
}) => Output | void;
```

### Basic Usage

```javascript
function meta(key, value) {
  return (_, context) => {
    context.metadata[key] = value;
  };
}

@meta('a', 'x')
class C {
  @meta('b', 'y')
  m() {}
}

C[Symbol.metadata].a; // 'x'
C[Symbol.metadata].b; // 'y'
```

### Key Properties

1. **Same object for all decorators** - The same metadata object is passed to every decorator on a class
2. **Accessible via `Symbol.metadata`** - After decoration, metadata is available on `Class[Symbol.metadata]`
3. **Plain JavaScript object** - No special API, just a regular object

## Inheritance

The metadata object's prototype is set to the parent class's metadata object:

```javascript
@meta('a', 'x')
class C {
  @meta('b', 'y')
  m() {}
}

class D extends C {
  @meta('b', 'z')  // Shadows parent's 'b'
  m() {}
}

D[Symbol.metadata].a; // 'x' (inherited)
D[Symbol.metadata].b; // 'z' (shadowed)
```

This enables natural inheritance patterns - child classes can read and extend parent metadata.

## Private Metadata Pattern

Use the metadata object as a `WeakMap` key for private metadata:

```javascript
const PRIVATE_METADATA = new WeakMap();

function meta(key, value) {
  return (_, context) => {
    let metadata = PRIVATE_METADATA.get(context.metadata);
    if (!metadata) {
      metadata = {};
      PRIVATE_METADATA.set(context.metadata, metadata);
    }
    metadata[key] = value;
  };
}

@meta('secret', 'hidden')
class C {}

PRIVATE_METADATA.get(C[Symbol.metadata]).secret; // 'hidden'
```

## Use Cases Enabled

- **Validation** - Store validation rules on properties
- **Serialization** - Store serialization config
- **Web Component Definition** - Store component config
- **Dependency Injection** - Store injection tokens
- **Declarative Routing** - Store route metadata
- **CLI Argument Parsing** - Store arg/option config (clepo's use case!)

## Comparison with `emitDecoratorMetadata`

| Feature | `emitDecoratorMetadata` | Decorator Metadata |
|---------|------------------------|-------------------|
| Automatic type info | Yes (`design:type`) | No |
| Runtime availability | Via `Reflect.getMetadata` | Via `Symbol.metadata` |
| Inheritance | Manual via Reflect | Automatic via prototype chain |
| Private metadata | Requires keys | Native WeakMap pattern |
| Standardized | No (TypeScript only) | Yes (TC39 Stage 3) |

### Critical Difference

**Decorator Metadata does NOT provide automatic type information.** You must manually store type info:

```javascript
// With emitDecoratorMetadata (automatic):
const type = Reflect.getMetadata("design:type", target, key); // String, Number, etc.

// With Decorator Metadata (manual):
function typed(type) {
  return (_, context) => {
    context.metadata.types ??= {};
    context.metadata.types[context.name] = type;
  };
}

class C {
  @typed(String)  // Must explicitly provide type
  name: string;
}
```

## TypeScript Support

TypeScript 5.2+ supports Decorator Metadata when using TC39 decorators (not `experimentalDecorators`).

```typescript
// tsconfig.json or deno.json
{
  "compilerOptions": {
    // DON'T use experimentalDecorators with Symbol.metadata
    // "experimentalDecorators": true,  // OFF
    // "emitDecoratorMetadata": true,   // OFF
  }
}
```

## Implications for clepo

### Advantages

1. **Standardized** - Will work across all runtimes without polyfills
2. **Inheritance built-in** - Command metadata can be inherited naturally
3. **WeakMap pattern** - Can store private implementation details
4. **No reflect-metadata dependency** - Uses native `Symbol.metadata`

### Challenges

1. **No automatic types** - Must provide explicit type config or use defaults
2. **Different API** - Need to migrate from `Reflect.getMetadata` to `Symbol.metadata`
3. **Ecosystem split** - Many libraries still use `experimentalDecorators`

### Migration Strategy for clepo

```javascript
// 1. Check for Symbol.metadata (TC39 decorators)
if (Symbol.metadata && Command[Symbol.metadata]) {
  const args = Command[Symbol.metadata].args;
}
// 2. Fall back to Reflect.getMetadata (legacy decorators)
else if (typeof Reflect !== 'undefined' && Reflect.getMetadata) {
  const args = Reflect.getMetadata('args', Command);
}
```

## Related Resources

- TC39 Decorators Proposal: https://github.com/tc39/proposal-decorators
- TypeScript 5.2 Release Notes: https://devblogs.microsoft.com/typescript/announcing-typescript-5-2/
