/**
 * What this package has to be true of before anything may be committed.
 *
 * Deliberately harsher than the code currently is. A lint set tuned to what
 * already passes measures nothing, and the point of putting it here is that it
 * refuses work rather than describes it.
 *
 * @module
 */

import defaultLints from "@hiisi/viola-default-lints";
import typescript from "@hiisi/viola-grammar-ts";
import { report, viola, when } from "@hiisi/viola";

export default viola()
  .use(defaultLints)
  // the grammar is what turns a file into something a lint can ask questions
  // of. the alias defaults to the grammar's own id, so naming it "typescript"
  // said the same thing twice.
  .add(typescript)
  // anything a linter has any confidence in at all is a failure. a warning
  // is a finding nobody acts on, and a gate that warns is not a gate. the
  // floor was 50 and everything under it passed silently.
  .rule(report.error, when.confidence.atLeast(1))
  // tests are held to the same bar as source. a fixture that drifts is how a
  // suite stops measuring the thing it names.
  .rule(report.error, when.in("tests/**/*.ts"))
  // fixtures that are supposed to be wrong are the one exception, since being
  // wrong is their entire job.
  .rule(report.off, when.in("tests/compile_fail/**"))
  .rule(report.off, when.in("**/fixtures/**"))
  // a literal spelled out across several test cases is several tests each
  // asserting its own expected value. counting those toward a duplication
  // threshold asks for a shared constant, and a test comparing a constant to
  // itself has stopped testing anything. they still show in the locations
  // list, they just do not push a string over the threshold on their own.
  .set("duplicate-strings.countIn", [
    "**",
    "!**/*_test.ts",
    "!**/*.test.ts",
    "!**/tests/**",
    "!**/fixtures/**",
  ])
  // `list` and `short` are members of union types, `"string" | "number" |
  // "boolean" | "list"` and `"short" | "long"`. A type-level literal is not a
  // repeated string constant: extracting it would put a runtime value where the
  // type system wants a literal, and the union would still have to spell it out.
  //
  // viola reads declared vocabulary out of type aliases and interface bodies
  // and does not yet read it out of property and parameter annotations, which
  // is where both of these live. That is an upstream gap rather than a fact
  // about this package, and it is filed.
  .set("duplicate-strings.ignoreStrings", ["list", "short"])
  // `addValTo` and `addIndexTo` push onto different fields of the same matched
  // argument. They already share their lookup through one private helper, and
  // what is left is two names for two operations a caller genuinely picks
  // between. Merging them further would replace a clear pair with one method
  // taking a discriminator, which is a worse api for a better number.
  .set("duplicate-logic.ignoreFunctions", ["addValTo", "addIndexTo"]);
