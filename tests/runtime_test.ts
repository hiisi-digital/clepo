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
  // What ships, read from the manifest, rather than whatever happens to sit at
  // the root. The guard is about the published package: a consumer on node or
  // bun gets exactly `publish.include` and nothing else.
  //
  // Reading the directory instead caught `gate.ts`, which runs this package's
  // linter, is deno-only by nature and is not published. That is a true fact
  // about a file nobody installs, and it would have made every package fail
  // this the moment it grew any dev tooling at its root.
  const manifest = JSON.parse(
    await Deno.readTextFile(new URL("../deno.json", import.meta.url)),
  ) as { publish?: { include?: string[] } };
  const names = (manifest.publish?.include ?? [])
    .filter((name) => name.endsWith(".ts"))
    .sort();
  if (names.length === 0) {
    throw new Error(
      "publish.include names no typescript files, so this guard would pass by " +
        "reading nothing.",
    );
  }

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

Deno.test("no source file under the package root names a runtime global", async () => {
  assertEquals(
    offending(await codeLines(), /\bDeno\./),
    [],
    "these make the package deno-only",
  );
});

Deno.test("no source file under the package root imports a platform module", async () => {
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
