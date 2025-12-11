# Bun Macros Research Summary

**Source:** https://bun.sh/docs/bundler/macros
**Fetched:** January 2025

## Overview

Bun Macros are a **Bun-specific** feature that allows running JavaScript functions at bundle-time. The returned values are directly inlined into the bundle. This is a compile-time code execution feature, not a metaprogramming/annotation system.

## How It Works

```javascript
// random.ts
export function random() {
  return Math.random();
}

// cli.tsx - using macro import
import { random } from "./random.ts" with { type: "macro" };

console.log(`Your random number is ${random()}`);

// After bundling:
console.log(`Your random number is ${0.6805550949689833}`);
```

The `random()` function is executed at bundle-time, and the call is replaced with the result.

## Key Features

### Import Syntax
Uses import attributes (TC39 Stage 3):
```javascript
import { fn } from "./module.ts" with { type: "macro" };
// or legacy assertion syntax:
import { fn } from "./module.ts" assert { type: "macro" };
```

### What Macros Can Do
- Execute arbitrary JavaScript at bundle-time
- Make HTTP requests (`fetch()`)
- Read files/run shell commands
- Return serializable values (JSON, Response, Blob, TypedArray)

### Security
- Must explicitly use `{ type: "macro" }` to enable
- **Cannot be invoked from `node_modules`** - security protection
- Can be disabled entirely with `--no-macros`

### Serializability
Returned values must be serializable:
- ✅ JSON-compatible data
- ✅ Promises (awaited automatically)
- ✅ Response, Blob, TypedArray
- ❌ Functions
- ❌ Class instances (most)

### Dead Code Elimination
Macros integrate with DCE:
```javascript
function returnFalse() { return false; }

if (returnFalse()) {
  console.log("Eliminated"); // Removed from bundle
}
```

## Limitations for clepo

### Bun-Only
This is a Bun-specific feature. It does NOT work with:
- Deno
- Node.js
- Standard TypeScript compiler
- esbuild, webpack, etc.

### Not Runtime Metaprogramming
Macros run at **bundle-time**, not at class definition time:
- Cannot decorate classes at runtime
- Cannot inspect class metadata
- Cannot work with instance creation

### Different Use Case
Bun macros are for:
- Embedding build-time values (git commit hash)
- Pre-computing expensive operations
- Fetching data at build time

NOT for:
- Runtime class decoration
- Metadata annotation
- Dependency injection
- CLI argument parsing

## Example Use Cases

### Embed Git Commit Hash
```javascript
// getGitCommitHash.ts
export function getGitCommitHash() {
  const { stdout } = Bun.spawnSync({
    cmd: ["git", "rev-parse", "HEAD"],
    stdout: "pipe",
  });
  return stdout.toString();
}

// usage
import { getGitCommitHash } from "./getGitCommitHash.ts" with { type: "macro" };
console.log(`Commit: ${getGitCommitHash()}`);
// Output: console.log(`Commit: abc123def...`);
```

### Bundle-Time Fetch
```javascript
export async function extractMetaTags(url: string) {
  const response = await fetch(url);
  // parse and return...
  return meta;
}

// The fetch happens at build time, result is embedded
```

## Implications for clepo

### Not a Decorator Alternative
Bun macros solve a completely different problem than decorators:
- Decorators: Runtime class metaprogramming
- Macros: Build-time value computation

### Could Complement Decorators
Bun macros could theoretically be used to:
- Generate type metadata at build time
- Pre-compute argument schemas
- Embed CLI help text

But this would:
1. Make clepo Bun-only
2. Add significant complexity
3. Fight against the decorator-based architecture

### Recommendation
**Do not pursue Bun macros for clepo.** They don't solve the decorator/metadata problem and would limit runtime compatibility.

## Comparison with Babel Macros

| Feature | Bun Macros | Babel Macros |
|---------|------------|--------------|
| Runtime | Bun only | Any Babel setup |
| Execution | Bundle-time | Compile-time |
| AST access | No (value only) | Yes (full AST) |
| Adoption | Bun users | Create React App, etc. |

## Conclusion

Bun Macros are an interesting compile-time feature but are **not relevant** to clepo's decorator/metadata needs because:

1. They're Bun-specific (clepo targets Deno)
2. They run at bundle-time, not runtime
3. They compute values, not decorate classes
4. They don't provide metadata/annotation capabilities

Decorators remain the correct approach for clepo.
