# TC39 Decorators Proposal Research Summary

**Source:** https://github.com/tc39/proposal-decorators
**Stage:** 3 (nearing completion)
**Fetched:** January 2025

## Overview

The TC39 decorators proposal defines a standard mechanism for extending JavaScript classes through decorator functions. This is the "new" decorator standard that TypeScript 5.0+ implements natively.

## Core Concepts

### What Decorators Can Do

Decorators have three primary capabilities:
1. **Replace** the decorated value with a matching value (same semantics)
2. **Provide access** to the value via accessor functions
3. **Initialize** the value with additional setup code

### What Can Be Decorated

- Classes
- Class fields (public, private, static)
- Class methods (public, private, static)
- Class accessors/getters/setters (public, private, static)
- **Class auto-accessors** (new construct with `accessor` keyword)

## Decorator Signature

```typescript
type Decorator = (value: Input, context: {
  kind: "class" | "method" | "getter" | "setter" | "field" | "accessor";
  name: string | symbol;
  access: {
    get?(): unknown;
    set?(value: unknown): void;
  };
  private?: boolean;
  static?: boolean;
  addInitializer(initializer: () => void): void;
}) => Output | void;
```

### Key Context Properties

- **kind**: Type of element being decorated
- **name**: Name of the element (or description for private elements)
- **access**: Object with get/set for accessing the final value
- **static**: Whether the element is static
- **private**: Whether the element is private
- **addInitializer**: Add initialization logic

## Class Auto-Accessors

A new class element type using the `accessor` keyword:

```javascript
class C {
  accessor x = 1;
}
// Desugars to:
class C {
  #x = 1;
  get x() { return this.#x; }
  set x(val) { this.#x = val; }
}
```

This enables decorators to intercept get/set without manual getter/setter boilerplate.

## Decorator Evaluation Order

1. **Evaluate**: Decorator expressions evaluated with computed property names
2. **Call**: Decorators called during class definition, after methods evaluated
3. **Apply**: All decorators applied at once, after all have been called

## Comparison with Legacy Decorators

### vs Babel Legacy Decorators
- Legacy exposes incomplete class to decorators (new proposal does not)
- Legacy receives full property descriptor (new proposal receives just the value)
- Legacy allowed coalescing getter/setter pairs (removed in new proposal)

### vs TypeScript Experimental Decorators
- No parameter decorators in new proposal (may come as built-in decorators)
- Different execution order (new proposal follows source order, TS experimental runs all instance before static)
- **No `emitDecoratorMetadata` equivalent** - metadata must be managed via `context.metadata` (separate proposal)

## Key Limitations for clepo

### No Automatic Type Information
Unlike `emitDecoratorMetadata`, the TC39 decorators do NOT provide automatic type information. The `context` object has no `design:type` equivalent.

### No Parameter Decorators (Yet)
Parameter decorators are not included in the current proposal. They may come as built-in decorators in future extensions (see EXTENSIONS.md).

### Field Decorators Don't Receive Value
Field decorators receive `undefined` as the value (since fields are initialized per-instance). They return an initializer function instead.

## The `addInitializer` Pattern

Useful for registration-style decorators:

```javascript
function customElement(name) {
  return (value, { addInitializer }) => {
    addInitializer(function() {
      customElements.define(name, this);
    });
  }
}

@customElement('my-element')
class MyElement extends HTMLElement {}
```

## Access Object for Metadata Sidechanneling

The `access` property enables dependency injection patterns:

```javascript
function inject(key) {
  return function(v, context) {
    injections.push({ key, set: context.access.set });
  };
}
```

## Implications for clepo

1. **Must use `accessor` for intercepting fields** - Regular fields can only have initializer wrapped
2. **No automatic type info** - Need explicit type config or use Decorator Metadata proposal
3. **Registration via addInitializer** - Good pattern for command/arg registration
4. **Access object useful** - Can build type validators and serializers

## Related Proposals

- **Decorator Metadata** (separate Stage 3 proposal) - Provides `context.metadata` and `Symbol.metadata`
- **EXTENSIONS.md** - Future work including parameter decorators, function decorators, etc.
