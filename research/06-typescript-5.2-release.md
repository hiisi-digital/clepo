# TypeScript 5.2 Release Notes Research Summary

**Source:** https://devblogs.microsoft.com/typescript/announcing-typescript-5-2/
**Date:** August 24, 2023
**Fetched:** January 2025

## Overview

TypeScript 5.2 is a significant release that introduces two major features relevant to clepo:
1. **Decorator Metadata** - The TC39 Stage 3 feature for decorator metadata
2. **`using` Declarations** - Explicit Resource Management

## Decorator Metadata in TypeScript 5.2

### Implementation Details

TypeScript 5.2 implements the TC39 Decorator Metadata proposal. Key points:

```typescript
interface Context {
    name: string;
    metadata: Record<PropertyKey, unknown>;
}

function setMetadata(_target: any, context: Context) {
    context.metadata[context.name] = true;
}

class SomeClass {
    @setMetadata
    foo = 123;

    @setMetadata
    accessor bar = "hello!";

    @setMetadata
    baz() { }
}

const ourMetadata = SomeClass[Symbol.metadata];
console.log(JSON.stringify(ourMetadata));
// { "bar": true, "baz": true, "foo": true }
```

### Usage Patterns Demonstrated

#### Public Metadata (Direct Storage)
```typescript
function serialize(_target: any, context: Context): void {
    const propNames = (context.metadata[serializables] as string[] | undefined) ??= [];
    propNames.push(context.name);
}
```

#### Private Metadata (WeakMap Pattern)
```typescript
const serializables = new WeakMap<object, string[]>();

function serialize(_target: any, context: Context): void {
    let propNames = serializables.get(context.metadata);
    if (propNames === undefined) {
        serializables.set(context.metadata, propNames = []);
    }
    propNames.push(context.name);
}
```

### Requirements for Using Decorator Metadata

1. **Polyfill `Symbol.metadata`**:
   ```javascript
   Symbol.metadata ??= Symbol("Symbol.metadata");
   ```

2. **TypeScript Configuration**:
   ```json
   {
     "compilerOptions": {
       "target": "es2022",
       "lib": ["es2022", "esnext.decorators", "dom"]
     }
   }
   ```

3. **Do NOT use with `experimentalDecorators`** - TC39 decorators and legacy decorators are mutually exclusive

## `using` Declarations (Explicit Resource Management)

New syntax for automatic cleanup:

```typescript
function doSomeWork() {
    using file = new TempFile(".some_temp_file");
    // use file...
    // file[Symbol.dispose]() is called automatically at end of scope
}
```

### Relevant for clepo?
Not directly, but could be useful for:
- Managing CLI resources (file handles, connections)
- Cleanup after command execution

## Other Notable Features

### Named and Anonymous Tuple Elements
Tuples can now mix labeled and unlabeled elements.

### `symbol`s as `WeakMap` and `WeakSet` Keys
Important for private metadata pattern.

### Copying Array Methods
New non-mutating methods: `toSorted`, `toSpliced`, `toReversed`, `with`

## Key Implications for clepo

### What This Means

1. **Decorator Metadata is official** - Not experimental, proper TC39 Stage 3
2. **Symbol.metadata is the access point** - Not `Reflect.getMetadata`
3. **WeakMap pattern is blessed** - Official way to do private metadata
4. **Polyfill needed** - `Symbol.metadata` must be polyfilled in most runtimes

### Migration Path

From legacy decorators:
```typescript
// OLD (experimentalDecorators + emitDecoratorMetadata)
Reflect.getMetadata("design:type", target, propertyKey)
Reflect.getMetadata("custom:key", target)

// NEW (TC39 decorators + Symbol.metadata)
Class[Symbol.metadata].types[propertyKey]
Class[Symbol.metadata].customKey
```

### Serialization Example from Release Notes

The release notes show a complete `@serialize` / `jsonify` example that's very similar to what clepo needs for `@Arg` / command parsing. The pattern:

1. Decorator stores property names in metadata
2. External function reads metadata via `Symbol.metadata`
3. Uses stored info to process the instance

This is essentially clepo's pattern for:
1. `@Arg` stores argument config in metadata
2. Parser reads metadata via `Symbol.metadata`
3. Uses config to parse CLI arguments

## Confirmation: No Macros, No Attributes

The TypeScript 5.2 release notes confirm there are no:
- Compile-time macros
- First-class attributes
- Alternative annotation systems

Decorators remain the only metaprogramming mechanism.
