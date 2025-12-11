# TC39 Proposals Research Summary

**Source:** https://github.com/tc39/proposals
**Fetched:** January 2025

## Overview

The TC39 proposals repository tracks all ECMAScript proposals through their staged process. This research focuses on proposals relevant to clepo's metadata/decoration needs.

## Key Stage 3 Proposals (Likely to Ship)

### Decorators
- **Status:** Stage 3 (Test262 testing plan in progress)
- **Champion:** Kristen Hewell Garrett
- **Last Presented:** March 2023
- **Note:** This is the "new" TC39 decorator standard that TypeScript 5.0+ supports natively

### Decorator Metadata
- **Status:** Stage 3
- **Champion:** Kristen Hewell Garrett
- **Last Presented:** May 2023
- **Relevance:** This provides `context.metadata` object for sharing metadata between decorators - the replacement for `emitDecoratorMetadata`

### Explicit Resource Management
- **Status:** Stage 3 (Test262 testing in progress)
- **Champion:** Ron Buckton
- **Last Presented:** May 2025
- **Relevance:** Provides `using` and `await using` declarations for resource cleanup

## Key Stage 2 Proposals (Under Active Development)

### Extractors
- **Status:** Stage 2
- **Champion:** Ron Buckton
- **Stage 2.7 Reviewers:** Jordan Harband, Justin Ridgewell
- **Last Presented:** October 2024
- **Relevance:** Potentially interesting for pattern matching on CLI args

### Pipeline Operator
- **Status:** Stage 2
- **Champion:** J.S. Choi, Ron Buckton, Tab Atkins
- **Last Presented:** August 2021
- **Relevance:** Could enable fluent CLI builder patterns

### Module Expressions
- **Status:** Stage 2
- **Champion:** Surma, Nicolò Ribaudo
- **Last Presented:** November 2022
- **Relevance:** Inline module definitions - could be interesting for plugin systems

### Module Declarations
- **Status:** Stage 2
- **Champion:** Daniel Ehrenberg, Mark Miller, Nicolò Ribaudo
- **Last Presented:** November 2022
- **Relevance:** Named module blocks for encapsulation

### Structs (Fixed Layout Objects)
- **Status:** Stage 2
- **Champion:** Shu-yu Guo
- **Reviewers:** Mark Miller, Waldemar Horwat, Yulia Startsev, Nicolò Ribaudo
- **Last Presented:** October 2024
- **Relevance:** Fixed-layout objects could provide type information at runtime if adopted

## Notable Absences

### No First-Class Attributes Proposal
There is no TC39 proposal for first-class attributes similar to C# attributes or Java annotations. Decorators are the closest equivalent.

### No Macro Proposal
There is no macro system proposal in TC39. JavaScript's runtime nature makes compile-time macros challenging. The closest is:
- **Template Literal Types** (TypeScript-only, not TC39)
- **Tagged Template Literals** (existing ES6 feature)

## Implications for clepo

1. **Decorators are the path forward** - No alternative annotation system is coming to JavaScript
2. **Decorator Metadata (Stage 3)** - This is the official replacement for `emitDecoratorMetadata`
3. **No macros coming** - Build-time transformations remain framework-specific
4. **Structs proposal** - If this advances, it might eventually provide runtime type info, but it's years away
