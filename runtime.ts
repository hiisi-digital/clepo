//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * @module runtime
 *
 * The four things a command line framework needs from the runtime it is
 * standing on: the arguments, the environment, a way to stop, and the three
 * streams.
 *
 * All four are the same call on deno, node and bun, which is why this module
 * contains no branch and imports no shim. `Deno.args`, `Deno.env.toObject()`
 * and `Deno.exit()` are not: they are one runtime's spelling of something all
 * three have, and using them made the node build fail to compile at eight
 * sites and made the package deno-only for no benefit.
 *
 * The streams are the one place where the shapes genuinely differ, and
 * `node:stream` reconciles them: `Writable.toWeb` and `Readable.toWeb` hand
 * back the Web streams `Context` is declared in terms of, on every runtime.
 *
 * `tests/runtime_test.ts` runs the same assertions under all three, so this
 * claim is checked rather than asserted.
 */

import { Readable, Writable } from "node:stream";

/** The arguments after the program and the script, whichever runtime is asking. */
export function args(): string[] {
  return process.argv.slice(2);
}

/** The environment, as the plain object the parser reads. */
export function env(): Record<string, string> {
  return { ...process.env } as Record<string, string>;
}

/** Stop, with a status. Declared as returning `never` because it does not come back. */
export function exit(code: number): never {
  process.exit(code);
  // Unreachable, and present so the type is honest on a runtime whose own
  // declaration of `process.exit` is not.
  throw new Error("unreachable");
}

/** Standard output, as the Web stream `Context` is declared in terms of. */
export function stdout(): WritableStream<Uint8Array> {
  return Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
}

/** Standard error, likewise. */
export function stderr(): WritableStream<Uint8Array> {
  return Writable.toWeb(process.stderr) as WritableStream<Uint8Array>;
}

/** Standard input, likewise. */
export function stdin(): ReadableStream<Uint8Array> {
  return Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>;
}
