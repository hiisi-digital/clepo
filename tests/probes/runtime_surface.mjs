// Run under deno, node and bun by `tests/runtime_test.ts`. Plain JavaScript and
// no imports beyond `node:stream`, so every runtime can execute it unchanged.
//
// It answers one question: are the four things `runtime.ts` reaches for the
// same on all three? The answer decided that clepo needs no shim and no
// conditional compilation, only that it stop spelling them `Deno.*`.
const out = {};
out.argv = process.argv.slice(2);
out.envIsObject = typeof process.env === "object" && typeof process.env["CLEPO_PROBE"] === "string";
out.hasExit = typeof process.exit === "function";

const { Readable, Writable } = await import("node:stream");
out.stdoutIsWebWritable = Writable.toWeb(process.stdout) instanceof WritableStream;
out.stderrIsWebWritable = Writable.toWeb(process.stderr) instanceof WritableStream;
// Not constructed: `Readable.toWeb(process.stdin)` opens stdin and holds the
// process alive, which would hang the runner. Its presence is the claim.
out.hasReadableToWeb = typeof Readable.toWeb === "function";

// stderr, because stdout is one of the things under test.
process.stderr.write(JSON.stringify(out) + "\n");
process.exit(0);
