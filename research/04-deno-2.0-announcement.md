# Deno 2.0 Announcement Research Summary

**Source:** https://deno.com/blog/v2.0
**Date:** October 9, 2024
**Fetched:** January 2025

## Overview

Deno 2.0 is a major release focused on using Deno "at scale" with seamless Node.js/npm interoperability while maintaining Deno's core philosophy: native TypeScript support, web standards, batteries-included toolchain, and secure-by-default execution.

## Key Features for clepo

### TypeScript Support
- **Native TypeScript support** - No configuration needed, just works
- Uses TypeScript 5.x under the hood
- Supports both legacy `experimentalDecorators` and new TC39 decorators

### Node/npm Compatibility
- Full backwards compatibility with Node.js and npm (ESM)
- Native support for `package.json` and `node_modules`
- Can import npm packages directly via `npm:` specifiers
- Supports private npm registries via `.npmrc`

### Package Management
- `deno install` - Lightning fast dependency installation
- `deno add` / `deno remove` - Add/remove packages
- 15% faster than npm (cold cache), 90% faster (hot cache)

### JSR (JavaScript Registry)
- Modern registry that supports TypeScript natively
- Publish modules as TypeScript source code
- Auto-generates documentation from JSDoc
- ESM-only

### Toolchain
- `deno fmt` - Format TypeScript, JavaScript, JSON, Markdown, HTML, CSS, YAML
- `deno lint` - Linting with Node-specific rules and quick fixes
- `deno test` - Test runner, now supports `node:test`
- `deno compile` - Compile to executable (code signing, icons on Windows)
- `deno doc` - Generate documentation from JSDoc/source

## Notable for clepo's Decorator Story

### Decorator Support Status
Deno 2.0 uses TypeScript 5.x which means:
1. **TC39 Stage 3 decorators** work natively (no flag needed)
2. **Legacy `experimentalDecorators`** still work via `deno.json` config

### No Deno-Specific Annotation System
Deno does not introduce any alternative to decorators. It relies entirely on:
- TC39 decorators (the new standard)
- TypeScript experimental decorators (legacy)

### No Macro System
Deno does not provide any macro or compile-time code generation system. The philosophy is to stay close to web standards.

### JSR and Metadata
JSR understands TypeScript deeply for documentation generation, but this is registry-side analysis, not a runtime feature that clepo could leverage.

## Implications for clepo

1. **Stay with decorators** - Deno provides no alternative annotation mechanism
2. **Both decorator flavors work** - Can support legacy and TC39 decorators
3. **Target Deno 2.0+** - Good baseline for modern TypeScript features
4. **Consider JSR publishing** - Native TypeScript support, good documentation generation
5. **deno.json is the config** - Use it for decorator settings and other config

## Security Model

Deno's permission system applies to npm modules too:
- `--allow-read` for file system
- `--allow-net` for network
- `--allow-env` for environment variables

This doesn't directly affect clepo's decorator approach but is good for CLI security.

## Future Roadmap Items

- LTS releases starting with Deno 2.1
- Continued performance improvements
- Better Node.js compatibility

## No Alternative to Decorators

The Deno 2.0 announcement and documentation confirm:
- No first-class attributes system
- No macro system
- No compile-time code generation
- Decorators are the intended metaprogramming approach
