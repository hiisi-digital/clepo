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

interface Line {
  readonly where: string;
  readonly text: string;
}

/**
 * Every line of every root source that is code rather than prose.
 *
 * Read in one pass and shared by both guards, so neither awaits inside a loop
 * and neither can disagree with the other about which files count.
 */
async function codeLines(): Promise<Line[]> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(new URL("../", import.meta.url))) {
    if (entry.isFile && entry.name.endsWith(".ts")) names.push(entry.name);
  }
  names.sort();

  const files = await Promise.all(names.map(async (name) => ({
    name,
    text: await Deno.readTextFile(new URL(`../${name}`, import.meta.url)),
  })));

  const lines: Line[] = [];
  for (const { name, text } of files) {
    for (const [index, text_] of text.split("\n").entries()) {
      const trimmed = text_.trimStart();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
      lines.push({ where: `${name}:${index + 1}`, text: text_ });
    }
  }
  return lines;
}

function offending(lines: readonly Line[], pattern: RegExp): string[] {
  return lines.filter(({ text }) => pattern.test(text)).map(({ where, text }) =>
    `${where}: ${text.trim()}`
  );
}

Deno.test("no source file reaches for a runtime-specific global", async () => {
  assertEquals(
    offending(await codeLines(), /\bDeno\./),
    [],
    "these make the package deno-only",
  );
});

Deno.test("no source file imports a platform module directly", async () => {
  // `node:stream` was here, doing what shimp's `stdoutStream` does. It worked,
  // and it put one runtime's namespace in a package that targets three. Anything
  // this needs from the runtime comes through shimp, so the day one of them
  // diverges there is a single place to change rather than every consumer.
  assertEquals(
    offending(await codeLines(), /from\s+["']node:/),
    [],
    "these belong behind @hiisi/shimp",
  );
});
