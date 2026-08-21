//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * The runtime edge is the same call on deno, node and bun.
 *
 * `runtime.ts` claims that, and the claim is the reason this package needs no
 * shim and no conditional compilation. It was `Deno.args`, `Deno.env.toObject()`
 * and `Deno.exit()` before, which made the node build fail to compile at eight
 * sites and made a general-purpose CLI framework usable on one runtime.
 *
 * A claim that three runtimes agree cannot be checked on one of them, so the
 * probe runs under each and this file compares what came back. A runtime that is
 * not installed is reported and skipped rather than silently passing, because a
 * cross-runtime test that quietly ran once is worse than none.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";

const PROBE = new URL("./probes/runtime_surface.mjs", import.meta.url).pathname;

interface Surface {
  readonly argv: string[];
  readonly envIsObject: boolean;
  readonly hasExit: boolean;
  readonly stdoutIsWebWritable: boolean;
  readonly stderrIsWebWritable: boolean;
  readonly hasReadableToWeb: boolean;
}

async function under(runtime: string): Promise<Surface | undefined> {
  const [cmd, ...lead] = runtime === "deno" ? [Deno.execPath(), "run", "-A"] : [runtime];
  try {
    const { success, stderr } = await new Deno.Command(cmd ?? "", {
      args: [...lead, PROBE, "alpha", "beta"],
      env: { CLEPO_PROBE: "1" },
      stdout: "null",
      stderr: "piped",
    }).output();
    const text = new TextDecoder().decode(stderr).trim();
    if (!success) return undefined;
    return JSON.parse(text.split("\n").at(-1) ?? "") as Surface;
  } catch {
    return undefined;
  }
}

Deno.test("the runtime edge agrees across deno, node and bun", async () => {
  const runtimes = ["deno", "node", "bun"];
  const results = await Promise.all(runtimes.map(under));

  const missing = runtimes.filter((_, i) => results[i] === undefined);
  // deno is this test's own runtime, so its absence is not a thing that happens
  assert(results[0] !== undefined, "the probe failed under deno itself");

  for (const [i, surface] of results.entries()) {
    if (surface === undefined) continue;
    const name = runtimes[i];
    assertEquals(surface.argv, ["alpha", "beta"], `${name}: process.argv.slice(2)`);
    assertEquals(surface.envIsObject, true, `${name}: process.env`);
    assertEquals(surface.hasExit, true, `${name}: process.exit`);
    assertEquals(surface.stdoutIsWebWritable, true, `${name}: Writable.toWeb(process.stdout)`);
    assertEquals(surface.stderrIsWebWritable, true, `${name}: Writable.toWeb(process.stderr)`);
    assertEquals(surface.hasReadableToWeb, true, `${name}: Readable.toWeb`);
  }

  // Said out loud rather than passed over: a runtime that was not there did not
  // agree, it was not asked.
  assertEquals(missing, [], `not installed, so unchecked: ${missing.join(", ")}`);
});

Deno.test("no source file reaches for a runtime-specific global", async () => {
  // The defect this file exists for, kept from coming back. `Deno.` in a source
  // file is one runtime's spelling of something all three have.
  const offenders: string[] = [];
  for await (const entry of Deno.readDir(new URL("../", import.meta.url))) {
    if (!entry.isFile || !entry.name.endsWith(".ts")) continue;
    const text = await Deno.readTextFile(new URL(`../${entry.name}`, import.meta.url));
    for (const [index, line] of text.split("\n").entries()) {
      if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) continue;
      if (/\bDeno\./.test(line)) offenders.push(`${entry.name}:${index + 1}: ${line.trim()}`);
    }
  }
  assertEquals(offenders, [], "these make the package deno-only");
});
