//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * A consumer can ask what a command line means without running it.
 *
 * `run()` parses and then dispatches, so a tool whose argument handling has
 * tests could not use this package: there was no way to reach the parse. Every
 * CLI in this estate has such tests, which is a large part of why every one of
 * them kept its own parser.
 *
 * @module
 */

import { assert, assertEquals } from "@std/assert";

import { ArgAction, ArgBuilder, CommandBuilder, HelpGenerator, Parser } from "../mod.ts";

class Built {
  feature: string[] = [];
  verbose = false;
  run(): void {}
}

function otsoShaped(): CommandBuilder {
  const cmd = new CommandBuilder("otso")
    .setVersion("0.1.0")
    .setAbout("cross-runtime TypeScript builds from one source")
    .addArg(
      new ArgBuilder({
        id: "feature",
        short: "f",
        long: "feature",
        help: "Turn a feature on",
        action: ArgAction.Append,
      }),
    )
    .addArg(
      new ArgBuilder({
        id: "verbose",
        short: "v",
        long: "verbose",
        help: "Say more",
        action: ArgAction.SetTrue,
      }),
    );
  cmd.cls = Built;
  return cmd;
}

Deno.test("a repeated flag collects every value", () => {
  const result = new Parser(otsoShaped()).parse(["--feature", "json", "--feature", "toml"]);
  const instance = result.instance as unknown as Built;
  assertEquals(instance.feature, ["json", "toml"]);
});

Deno.test("the inline form is the same as the separated form", () => {
  // `--feature json` working and `--feature=json` silently doing nothing is
  // worse than the flag not existing, so both forms are pinned
  const separated = new Parser(otsoShaped()).parse(["--feature", "json"]);
  const inline = new Parser(otsoShaped()).parse(["--feature=json"]);
  assertEquals(
    (inline.instance as unknown as Built).feature,
    (separated.instance as unknown as Built).feature,
  );
});

Deno.test("a request for help is reported rather than acted on", () => {
  // the property that makes this usable from a test at all: parsing `--help`
  // must not print and must not exit
  const result = new Parser(otsoShaped()).parse(["--help"]);
  assertEquals(result.helpRequested, true);
});

Deno.test("the help renderer is reachable, and names the flags that were declared", () => {
  const text = new HelpGenerator(otsoShaped()).generate();
  for (const expected of ["--feature", "--verbose", "otso"]) {
    assert(text.includes(expected), `help does not mention ${expected}:\n${text}`);
  }
});
