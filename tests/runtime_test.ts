//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Nothing here reaches past `@hiisi/shimp` for the runtime.
 *
 * This package used to call `Deno.args`, `Deno.env.toObject()`, `Deno.exit()`
 * and the three `Deno.std*` streams directly, which failed to compile under dnt
 * at eight sites and made a general-purpose CLI framework usable on one runtime.
 *
 * The first repair swapped them for `process.*` and `node:stream`, which worked
 * and was the same mistake pointed the other way: a package written against
 * three runtimes importing one runtime's namespace, with the question of what
 * differs between them answered here instead of in the package whose subject it
 * is. `@hiisi/shimp` owns that question, its probes carry the measurements, and
 * its e2e compares the answers across all three.
 *
 * So what is left for this file is the boundary itself: no runtime global, and
 * no platform module, anywhere in the source.
 *
 * @module
 */

import { assertEquals } from "@std/assert";

/** Source files, which is every `.ts` at the root other than the tests. */
async function sources(): Promise<string[]> {
  const found: string[] = [];
  for await (const entry of Deno.readDir(new URL("../", import.meta.url))) {
    if (entry.isFile && entry.name.endsWith(".ts")) found.push(entry.name);
  }
  return found.sort();
}

function isProse(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*");
}

Deno.test("no source file reaches for a runtime-specific global", async () => {
  const offenders: string[] = [];
  for (const name of await sources()) {
    const text = await Deno.readTextFile(new URL(`../${name}`, import.meta.url));
    for (const [index, line] of text.split("\n").entries()) {
      if (isProse(line)) continue;
      if (/\bDeno\./.test(line)) offenders.push(`${name}:${index + 1}: ${line.trim()}`);
    }
  }
  assertEquals(offenders, [], "these make the package deno-only");
});

Deno.test("no source file imports a platform module directly", async () => {
  // `node:stream` was here, doing what shimp's `stdoutStream` does. It worked,
  // and it put a runtime's namespace in a package that targets three. Anything
  // this needs from the runtime comes through shimp, so that the day one of the
  // three diverges there is one place to change rather than every consumer.
  const offenders: string[] = [];
  for (const name of await sources()) {
    const text = await Deno.readTextFile(new URL(`../${name}`, import.meta.url));
    for (const [index, line] of text.split("\n").entries()) {
      if (isProse(line)) continue;
      if (/from\s+["']node:/.test(line)) offenders.push(`${name}:${index + 1}: ${line.trim()}`);
    }
  }
  assertEquals(offenders, [], "these belong behind @hiisi/shimp");
});
