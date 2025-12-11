// loru/packages/clepo/tests/integration_test.ts

import { assertEquals, assertInstanceOf, assertMatch, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Arg as ArgClass, ArgAction, createRangedParser, parseBoolish } from "../arg.ts";
import { Command as CommandBuilder, CommandSettings } from "../command.ts";
import { Arg, Command, getCommand, Subcommand, Subcommands } from "../decorators.ts";
import { ClepoError, ErrorKind } from "../error.ts";
import { HelpGenerator } from "../help.ts";
import { Parser } from "../parser.ts";
import { findClosestMatch, levenshteinDistance } from "../util.ts";

// --- Decorated Classes for Testing ---

@Command({
  name: "add",
  about: "Add file contents to the index",
})
class AddCmd {
  @Arg({
    required: true,
    help: "Files to add to the index",
  })
  pathspec!: string[];

  @Arg({
    long: "dry-run",
    help: "Don't actually add the file(s)",
    action: ArgAction.SetTrue,
  })
  dryRun = false;

  run(): Promise<void> {
    return Promise.resolve();
  }
}

@Command({
  name: "git",
  version: "1.0.0",
  about: "The stupid content tracker",
})
class GitCli {
  @Arg({
    short: "v",
    long: true, // inferred as --verbose
    action: ArgAction.Count,
    global: true,
    help: "Increase logging verbosity",
  })
  verbose = 0;

  @Subcommand([AddCmd])
  command!: AddCmd;

  run(): Promise<void> {
    return Promise.resolve();
  }
}

// Simple command for testing help/version
@Command({
  name: "simple",
  version: "2.0.0",
  about: "A simple test command",
})
class SimpleCmd {
  @Arg({
    short: "n",
    long: "name",
    help: "Your name",
    required: true,
  })
  name!: string;

  @Arg({
    short: "c",
    long: "count",
    help: "Number of times to greet",
    default: 1,
    valueParser: "number",
  })
  count = 1;

  run(): Promise<void> {
    return Promise.resolve();
  }
}

// Command without version (should not have -V flag)
@Command({
  name: "no-version",
  about: "A command without version",
})
class NoVersionCmd {
  @Arg({ help: "Some input" })
  input!: string;

  run(): Promise<void> {
    return Promise.resolve();
  }
}

// Command with env var support
@Command({
  name: "env-test",
  version: "1.0.0",
})
class EnvTestCmd {
  @Arg({
    long: "config",
    env: "APP_CONFIG",
    help: "Path to config file",
  })
  config?: string;

  @Arg({
    long: "debug",
    env: "APP_DEBUG",
    action: ArgAction.SetTrue,
  })
  debug = false;

  run(): Promise<void> {
    return Promise.resolve();
  }
}

// Command with value parser
@Command({
  name: "parser-test",
  version: "1.0.0",
})
class ParserTestCmd {
  @Arg({
    long: "port",
    help: "Port number",
    valueParser: "number",
  })
  port?: number;

  @Arg({
    long: "multiplier",
    help: "Multiplier value",
    valueParser: (val: string) => {
      const num = parseFloat(val);
      if (num <= 0) throw new Error("must be positive");
      return num;
    },
  })
  multiplier?: number;

  run(): Promise<void> {
    return Promise.resolve();
  }
}

// Command with possible values
@Command({
  name: "enum-test",
  version: "1.0.0",
})
class EnumTestCmd {
  @Arg({
    long: "level",
    help: "Log level",
    possibleValues: ["debug", "info", "warn", "error"],
  })
  level?: string;

  run(): Promise<void> {
    return Promise.resolve();
  }
}

// Command to test type inference with explicit type annotations
@Command({
  name: "type-infer-test",
  version: "1.0.0",
})
class TypeInferTestCmd {
  // Explicit type annotation should trigger auto number parsing
  @Arg({ long: "count", help: "A count value" })
  count: number = 0;

  // Explicit type annotation for boolean
  @Arg({ long: "enabled", help: "Enable something" })
  enabled: boolean = false;

  // Array type should infer Append action
  @Arg({ long: "items", help: "List of items" })
  items: string[] = [];

  run(): Promise<void> {
    return Promise.resolve();
  }
}

// --- Test Suite ---

describe("Clepo Integration Tests", () => {
  describe("Decorator API", () => {
    it("should parse a command with global flags and a subcommand", () => {
      const gitCommand = getCommand(GitCli);
      gitCommand.finalize();
      const parser = new Parser(gitCommand);

      const args = ["-v", "add", "mod.ts", "lib.ts", "--dry-run"];
      const result = parser.parse(args, {});

      assertInstanceOf(result.instance, GitCli);
      const git = result.instance as GitCli;
      assertEquals(git.verbose, 1);

      assertInstanceOf(git.command, AddCmd);
      const add = git.command as AddCmd;
      assertEquals(add.pathspec, ["mod.ts", "lib.ts"]);
      assertEquals(add.dryRun, true);
      assertEquals(result.command.name, "add");
    });

    it("should handle clustered short flags and default values", () => {
      const gitCommand = getCommand(GitCli);
      gitCommand.finalize();
      const parser = new Parser(gitCommand);

      const args = ["-vvv", "add", "main.ts"];
      const result = parser.parse(args, {});

      const git = result.instance as GitCli;
      assertEquals(git.verbose, 3);

      const add = git.command as AddCmd;
      assertEquals(add.pathspec, ["main.ts"]);
      assertEquals(add.dryRun, false); // Check default value
    });
  });

  describe("Builder API", () => {
    class GitBuilder {
      command?: AddBuilder;
      verbose = 0;
      run(): Promise<void> {
        return Promise.resolve();
      }
    }
    class AddBuilder {
      pathspec?: string[];
      dryRun = false;
      run(): Promise<void> {
        return Promise.resolve();
      }
    }

    it("should parse a command mirroring the decorator setup", () => {
      // Create fresh commands for each test to avoid finalization issues
      const freshAddCommand = new CommandBuilder("add")
        .setAbout("Add file contents to the index")
        .addArg(
          new ArgClass({
            id: "pathspec",
            required: true,
            action: ArgAction.Append,
            type: "list",
          }),
        )
        .addArg(
          new ArgClass({
            id: "dryRun",
            long: "dry-run",
            action: ArgAction.SetTrue,
            type: "boolean",
          }),
        );
      freshAddCommand.cls = AddBuilder;

      const freshGitCommand = new CommandBuilder("git")
        .setVersion("1.0.0")
        .setAbout("The stupid content tracker")
        .addArg(
          new ArgClass({
            id: "verbose",
            short: "v",
            long: "verbose",
            action: ArgAction.Count,
            global: true,
          }),
        )
        .addSubcommand(freshAddCommand);
      freshGitCommand.cls = GitBuilder;
      freshGitCommand.subcommandProperty = "command";

      freshGitCommand.finalize();
      const parser = new Parser(freshGitCommand);

      const args = ["-v", "add", "mod.ts", "lib.ts", "--dry-run"];
      const result = parser.parse(args, {});

      assertInstanceOf(result.instance, GitBuilder);
      const git = result.instance as GitBuilder;
      assertEquals(git.verbose, 1);

      assertInstanceOf(git.command, AddBuilder);
      const add = git.command as AddBuilder;
      assertEquals(add.pathspec, ["mod.ts", "lib.ts"]);
      assertEquals(add.dryRun, true);
    });
  });

  describe("Help and Version Flags", () => {
    it("should recognize --help flag and set helpRequested", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--help"], {});
      assertEquals(result.helpRequested, true);
      assertEquals(result.versionRequested, false);
    });

    it("should recognize -h flag and set helpRequested", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["-h"], {});
      assertEquals(result.helpRequested, true);
    });

    it("should recognize --version flag and set versionRequested", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--version"], {});
      assertEquals(result.versionRequested, true);
      assertEquals(result.helpRequested, false);
    });

    it("should recognize -V flag and set versionRequested", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["-V"], {});
      assertEquals(result.versionRequested, true);
    });

    it("should not inject version flag when no version is set", () => {
      const cmd = getCommand(NoVersionCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      // Should throw because -V is not recognized
      assertThrows(
        () => parser.parse(["-V"], {}),
        ClepoError,
        "wasn't expected",
      );
    });

    it("should generate help text with proper formatting", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const help = new HelpGenerator(cmd).generate();

      // Check that help contains expected sections
      assertEquals(help.includes("simple"), true);
      assertEquals(help.includes("2.0.0"), true);
      assertEquals(help.includes("A simple test command"), true);
      assertEquals(help.includes("--name"), true);
      assertEquals(help.includes("--count"), true);
      assertEquals(help.includes("--help"), true);
      assertEquals(help.includes("--version"), true);
    });
  });

  describe("Environment Variables", () => {
    it("should read value from environment variable", () => {
      const cmd = getCommand(EnvTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse([], { APP_CONFIG: "/etc/app.conf" });
      const instance = result.instance as EnvTestCmd;

      assertEquals(instance.config, "/etc/app.conf");
    });

    it("should prefer CLI arg over environment variable", () => {
      const cmd = getCommand(EnvTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(
        ["--config", "/cli/path.conf"],
        { APP_CONFIG: "/env/path.conf" },
      );
      const instance = result.instance as EnvTestCmd;

      assertEquals(instance.config, "/cli/path.conf");
    });
  });

  describe("Value Parsing", () => {
    it("should parse number values", () => {
      const cmd = getCommand(ParserTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--port", "8080"], {});
      const instance = result.instance as ParserTestCmd;

      assertEquals(instance.port, 8080);
    });

    it("should reject invalid number values", () => {
      const cmd = getCommand(ParserTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      assertThrows(
        () => parser.parse(["--port", "not-a-number"], {}),
        ClepoError,
        "expected a number",
      );
    });

    it("should use custom value parser", () => {
      const cmd = getCommand(ParserTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--multiplier", "2.5"], {});
      const instance = result.instance as ParserTestCmd;

      assertEquals(instance.multiplier, 2.5);
    });

    it("should reject values that fail custom parser", () => {
      const cmd = getCommand(ParserTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      assertThrows(
        () => parser.parse(["--multiplier", "-1"], {}),
        ClepoError,
        "must be positive",
      );
    });
  });

  describe("Possible Values", () => {
    it("should accept valid possible values", () => {
      const cmd = getCommand(EnumTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--level", "debug"], {});
      const instance = result.instance as EnumTestCmd;

      assertEquals(instance.level, "debug");
    });

    it("should reject invalid possible values", () => {
      const cmd = getCommand(EnumTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      assertThrows(
        () => parser.parse(["--level", "verbose"], {}),
        ClepoError,
        "is not a valid value",
      );
    });
  });

  describe("Error Handling", () => {
    it("should throw for unknown arguments", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      assertThrows(
        () => parser.parse(["--unknown"], {}),
        ClepoError,
        "wasn't expected",
      );
    });

    it("should throw for missing required arguments", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      assertThrows(
        () => parser.parse([], {}),
        ClepoError,
        "required argument was not provided",
      );
    });

    it("should throw for missing argument values", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      assertThrows(
        () => parser.parse(["--name"], {}),
        ClepoError,
        "requires a value",
      );
    });

    it("should have correct error kind for unknown argument", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      try {
        parser.parse(["--unknown"], {});
      } catch (e) {
        assertInstanceOf(e, ClepoError);
        assertEquals(e.kind, ErrorKind.UnknownArgument);
      }
    });

    it("should have correct error kind for missing required argument", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      try {
        parser.parse([], {});
      } catch (e) {
        assertInstanceOf(e, ClepoError);
        assertEquals(e.kind, ErrorKind.MissingRequiredArgument);
      }
    });
  });

  describe("Default Values", () => {
    it("should use default values when argument not provided", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--name", "Alice"], {});
      const instance = result.instance as SimpleCmd;

      assertEquals(instance.count, 1);
    });

    it("should override default values when argument provided", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--name", "Alice", "--count", "5"], {});
      const instance = result.instance as SimpleCmd;

      assertEquals(instance.count, 5);
    });
  });

  describe("Long Flag Variations", () => {
    it("should handle --flag=value syntax", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--name=Bob"], {});
      const instance = result.instance as SimpleCmd;

      assertEquals(instance.name, "Bob");
    });

    it("should handle --flag value syntax", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--name", "Charlie"], {});
      const instance = result.instance as SimpleCmd;

      assertEquals(instance.name, "Charlie");
    });
  });

  describe("Short Flag Variations", () => {
    it("should handle -f value syntax", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["-n", "Dave"], {});
      const instance = result.instance as SimpleCmd;

      assertEquals(instance.name, "Dave");
    });

    it("should handle -fvalue syntax (attached value)", () => {
      const cmd = getCommand(SimpleCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["-nEve"], {});
      const instance = result.instance as SimpleCmd;

      assertEquals(instance.name, "Eve");
    });
  });

  describe("Type Inference", () => {
    it("should auto-parse numbers when property has explicit type annotation", () => {
      const cmd = getCommand(TypeInferTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--count", "42"], {});
      const instance = result.instance as TypeInferTestCmd;

      assertEquals(instance.count, 42);
      assertEquals(typeof instance.count, "number");
    });

    it("should infer SetTrue action for boolean properties", () => {
      const cmd = getCommand(TypeInferTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--enabled"], {});
      const instance = result.instance as TypeInferTestCmd;

      assertEquals(instance.enabled, true);
    });

    it("should infer Append action for array properties", () => {
      const cmd = getCommand(TypeInferTestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--items", "a", "--items", "b"], {});
      const instance = result.instance as TypeInferTestCmd;

      assertEquals(instance.items, ["a", "b"]);
    });

    it("should use explicit type config over reflection (TC39 future-proofing)", () => {
      // This test verifies that explicit type configuration works,
      // which is essential for TC39 decorators that don't support emitDecoratorMetadata
      @Command({
        name: "explicit-type-test",
        version: "1.0.0",
      })
      class ExplicitTypeCmd {
        // Explicit type: "number" - should auto-parse as number
        @Arg({ long: "count", type: "number" })
        count!: number;

        // Explicit type: "boolean" with SetTrue action
        @Arg({ long: "verbose", type: "boolean" })
        verbose = false;

        // Explicit type: "list" for array
        @Arg({ long: "items", type: "list" })
        items!: string[];

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const cmd = getCommand(ExplicitTypeCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      // Test number parsing works with explicit type
      const result1 = parser.parse(["--count", "42"], {});
      const instance1 = result1.instance as ExplicitTypeCmd;
      assertEquals(instance1.count, 42);
      assertEquals(typeof instance1.count, "number");

      // Test boolean flag works with explicit type
      const result2 = parser.parse(["--verbose"], {});
      const instance2 = result2.instance as ExplicitTypeCmd;
      assertEquals(instance2.verbose, true);

      // Test list works with explicit type
      const result3 = parser.parse(["--items", "a", "--items", "b"], {});
      const instance3 = result3.instance as ExplicitTypeCmd;
      assertEquals(instance3.items, ["a", "b"]);
    });
  });

  describe("Escape Sequence (--)", () => {
    it("should treat arguments after -- as positional values", () => {
      // Create a command that takes positional args
      @Command({
        name: "echo-cmd",
        version: "1.0.0",
      })
      class EchoCmd {
        @Arg({ required: true, action: ArgAction.Append })
        args!: string[];

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const cmd = getCommand(EchoCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      // Without --, the --flag would be treated as an unknown flag
      // With --, it becomes a positional value
      const result = parser.parse(["first", "--", "--not-a-flag", "-x"], {});
      const instance = result.instance as EchoCmd;

      assertEquals(instance.args, ["first", "--not-a-flag", "-x"]);
    });
  });

  describe("Command Settings", () => {
    it("should require subcommand when SubcommandRequired is set", () => {
      class SubCmd {
        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const subCmd = new CommandBuilder("sub");
      subCmd.cls = SubCmd;

      class ParentBuilder {
        command?: SubCmd;
        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const parentCmd = new CommandBuilder("parent")
        .setting(CommandSettings.SubcommandRequired)
        .addSubcommand(subCmd);
      parentCmd.cls = ParentBuilder;
      parentCmd.subcommandProperty = "command";

      parentCmd.finalize();
      const parser = new Parser(parentCmd);

      assertThrows(
        () => parser.parse([], {}),
        ClepoError,
        "requires a subcommand",
      );
    });
  });

  describe("Boolish Value Parser", () => {
    it("should accept truthy boolish values", () => {
      assertEquals(parseBoolish("true"), true);
      assertEquals(parseBoolish("TRUE"), true);
      assertEquals(parseBoolish("yes"), true);
      assertEquals(parseBoolish("YES"), true);
      assertEquals(parseBoolish("on"), true);
      assertEquals(parseBoolish("ON"), true);
      assertEquals(parseBoolish("1"), true);
    });

    it("should accept falsy boolish values", () => {
      assertEquals(parseBoolish("false"), false);
      assertEquals(parseBoolish("FALSE"), false);
      assertEquals(parseBoolish("no"), false);
      assertEquals(parseBoolish("NO"), false);
      assertEquals(parseBoolish("off"), false);
      assertEquals(parseBoolish("OFF"), false);
      assertEquals(parseBoolish("0"), false);
    });

    it("should reject invalid boolish values", () => {
      assertThrows(() => parseBoolish("maybe"), Error);
      assertThrows(() => parseBoolish("nope"), Error);
      assertThrows(() => parseBoolish(""), Error);
    });

    it("should parse boolish values via decorator", () => {
      @Command({ name: "boolish-test", version: "1.0.0" })
      class BoolishCmd {
        @Arg({ long: "debug", valueParser: "boolish" })
        debug = false;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const cmd = getCommand(BoolishCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result1 = parser.parse(["--debug", "yes"], {});
      assertEquals((result1.instance as BoolishCmd).debug, true);

      const result2 = parser.parse(["--debug", "no"], {});
      assertEquals((result2.instance as BoolishCmd).debug, false);

      const result3 = parser.parse(["--debug", "on"], {});
      assertEquals((result3.instance as BoolishCmd).debug, true);
    });
  });

  describe("Ranged Value Parser", () => {
    it("should accept values within range", () => {
      const ranged = createRangedParser(1, 100);
      assertEquals(ranged("1"), 1);
      assertEquals(ranged("50"), 50);
      assertEquals(ranged("100"), 100);
    });

    it("should reject values outside range", () => {
      const ranged = createRangedParser(1, 100);
      assertThrows(() => ranged("0"), Error, "out of range");
      assertThrows(() => ranged("101"), Error, "out of range");
      assertThrows(() => ranged("-5"), Error, "out of range");
    });

    it("should reject non-integer values", () => {
      const ranged = createRangedParser(1, 100);
      assertThrows(() => ranged("5.5"), Error, "expected an integer");
      assertThrows(() => ranged("abc"), Error, "expected a number");
    });

    it("should parse ranged values via decorator", () => {
      @Command({ name: "ranged-test", version: "1.0.0" })
      class RangedCmd {
        @Arg({ long: "port", valueParser: { ranged: [1, 65535] } })
        port = 8080;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const cmd = getCommand(RangedCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--port", "3000"], {});
      assertEquals((result.instance as RangedCmd).port, 3000);

      assertThrows(
        () => parser.parse(["--port", "70000"], {}),
        ClepoError,
        "out of range",
      );
    });
  });

  describe("Hide Option", () => {
    it("should hide arguments from help output", () => {
      @Command({ name: "hide-test", version: "1.0.0" })
      class HideCmd {
        @Arg({ long: "visible", help: "A visible option" })
        visible = false;

        @Arg({ long: "internal", help: "An internal option", hide: true })
        internal = false;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const cmd = getCommand(HideCmd);
      cmd.finalize();
      const help = new HelpGenerator(cmd).generate();

      // Visible option should appear in help
      assertMatch(help, /--visible/);
      assertMatch(help, /A visible option/);

      // Hidden option should NOT appear in help
      assertEquals(help.includes("--internal"), false);
      assertEquals(help.includes("An internal option"), false);
    });

    it("should still parse hidden arguments", () => {
      @Command({ name: "hide-parse-test", version: "1.0.0" })
      class HideParseCmd {
        // Explicitly declare boolean type for proper SetTrue action inference
        @Arg({ long: "internal", hide: true })
        internal: boolean = false;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const cmd = getCommand(HideParseCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      const result = parser.parse(["--internal"], {});
      assertEquals((result.instance as HideParseCmd).internal, true);
    });
  });

  describe("Subcommands() Factory API", () => {
    // --- Subcommand classes for testing ---
    @Command({
      name: "clone",
      about: "Clone a repository",
    })
    class CloneCmd {
      @Arg({ required: true, help: "Remote URL" })
      remote!: string;

      run(): Promise<void> {
        return Promise.resolve();
      }
    }

    @Command({
      name: "diff",
      about: "Show changes between commits",
    })
    class DiffCmd {
      @Arg({ long: "base", help: "Base commit" })
      base?: string;

      @Arg({ long: "head", help: "Head commit" })
      head?: string;

      run(): Promise<void> {
        return Promise.resolve();
      }
    }

    it("should work with Subcommands() and explicit @Subcommand decorator", () => {
      const Commands = Subcommands(CloneCmd, DiffCmd);

      @Command({ name: "git-explicit", version: "1.0.0" })
      class GitExplicit {
        @Arg({ short: "v", long: "verbose", action: ArgAction.SetTrue })
        verbose = false;

        @Subcommand(Commands)
        command = Commands;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const gitCommand = getCommand(GitExplicit);
      const parser = new Parser(gitCommand);

      const args = ["clone", "https://github.com/example/repo"];
      const result = parser.parse(args, {});

      const git = result.instance as GitExplicit;
      assertEquals(git.verbose, false);

      const clone = git.command as CloneCmd;
      assertInstanceOf(clone, CloneCmd);
      assertEquals(clone.remote, "https://github.com/example/repo");
    });

    it("should work with Subcommands() and auto-detection (no decorator)", () => {
      const Commands = Subcommands(CloneCmd, DiffCmd);

      @Command({ name: "git-auto", version: "1.0.0" })
      class GitAuto {
        @Arg({ short: "v", long: "verbose", action: ArgAction.SetTrue })
        verbose = false;

        // No @Subcommand decorator - auto-detected!
        command = Commands;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const gitCommand = getCommand(GitAuto);
      const parser = new Parser(gitCommand);

      const args = ["--verbose", "diff", "--base", "main"];
      const result = parser.parse(args, {});

      const git = result.instance as GitAuto;
      assertEquals(git.verbose, true);

      const diff = git.command as DiffCmd;
      assertInstanceOf(diff, DiffCmd);
      assertEquals(diff.base, "main");
    });

    it("should work with @Subcommand() empty decorator and Subcommands()", () => {
      const Commands = Subcommands(CloneCmd, DiffCmd);

      @Command({ name: "git-empty-decorator", version: "1.0.0" })
      class GitEmptyDecorator {
        @Subcommand()
        command = Commands;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const gitCommand = getCommand(GitEmptyDecorator);
      const parser = new Parser(gitCommand);

      const args = ["clone", "git@github.com:user/repo.git"];
      const result = parser.parse(args, {});

      const git = result.instance as GitEmptyDecorator;
      const clone = git.command as CloneCmd;
      assertInstanceOf(clone, CloneCmd);
      assertEquals(clone.remote, "git@github.com:user/repo.git");
    });

    it("should properly type the union result from Subcommands()", () => {
      const Commands = Subcommands(CloneCmd, DiffCmd);

      @Command({ name: "git-typed", version: "1.0.0" })
      class GitTyped {
        command = Commands;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const gitCommand = getCommand(GitTyped);
      const parser = new Parser(gitCommand);

      // Test CloneCmd path
      const cloneResult = parser.parse(["clone", "url"], {});
      const gitWithClone = cloneResult.instance as GitTyped;
      assertInstanceOf(gitWithClone.command, CloneCmd);

      // Test DiffCmd path
      const diffResult = parser.parse(["diff"], {});
      const gitWithDiff = diffResult.instance as GitTyped;
      assertInstanceOf(gitWithDiff.command, DiffCmd);
    });

    it("should work alongside global args with Subcommands()", () => {
      const Commands = Subcommands(CloneCmd, DiffCmd);

      @Command({ name: "git-global", version: "1.0.0" })
      class GitGlobal {
        @Arg({ short: "v", long: "verbose", action: ArgAction.Count, global: true })
        verbose = 0;

        @Arg({ short: "C", long: "directory", help: "Run as if git was started in <path>" })
        directory?: string;

        command = Commands;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const gitCommand = getCommand(GitGlobal);
      const parser = new Parser(gitCommand);

      const args = ["-C", "/tmp/repo", "-vvv", "clone", "https://example.com/repo"];
      const result = parser.parse(args, {});

      const git = result.instance as GitGlobal;
      assertEquals(git.verbose, 3);
      assertEquals(git.directory, "/tmp/repo");

      const clone = git.command as CloneCmd;
      assertInstanceOf(clone, CloneCmd);
      assertEquals(clone.remote, "https://example.com/repo");
    });

    it("should maintain backward compatibility with array-based @Subcommand", () => {
      // This test ensures the old API still works
      @Command({ name: "git-old", version: "1.0.0" })
      class GitOld {
        @Subcommand([CloneCmd, DiffCmd])
        command!: CloneCmd | DiffCmd;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const gitCommand = getCommand(GitOld);
      const parser = new Parser(gitCommand);

      const args = ["diff", "--head", "feature-branch"];
      const result = parser.parse(args, {});

      const git = result.instance as GitOld;
      const diff = git.command as DiffCmd;
      assertInstanceOf(diff, DiffCmd);
      assertEquals(diff.head, "feature-branch");
    });
  });

  describe("Did You Mean Suggestions", () => {
    it("should calculate levenshtein distance correctly", () => {
      assertEquals(levenshteinDistance("kitten", "sitting"), 3);
      assertEquals(levenshteinDistance("", "abc"), 3);
      assertEquals(levenshteinDistance("abc", ""), 3);
      assertEquals(levenshteinDistance("abc", "abc"), 0);
      assertEquals(levenshteinDistance("verbose", "verbos"), 1);
    });

    it("should find closest match", () => {
      const candidates = ["verbose", "version", "help", "config"];
      assertEquals(findClosestMatch("verbos", candidates), "verbose");
      assertEquals(findClosestMatch("versoin", candidates), "version");
      assertEquals(findClosestMatch("hlp", candidates), "help");
      assertEquals(findClosestMatch("xyz123", candidates), undefined);
    });

    it("should suggest similar long flags on typo", () => {
      @Command({ name: "suggest-test", version: "1.0.0" })
      class SuggestCmd {
        @Arg({ long: "verbose" })
        verbose = false;

        @Arg({ long: "config" })
        config?: string;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const cmd = getCommand(SuggestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      try {
        parser.parse(["--verbos"], {});
      } catch (e) {
        assertInstanceOf(e, ClepoError);
        assertEquals(e.kind, ErrorKind.UnknownArgument);
        assertMatch(e.message, /--verbos.*wasn't expected/);
        assertMatch(e.message, /tip:.*--verbose/);
      }
    });

    it("should not suggest when no close match exists", () => {
      @Command({ name: "no-suggest-test", version: "1.0.0" })
      class NoSuggestCmd {
        @Arg({ long: "verbose" })
        verbose = false;

        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const cmd = getCommand(NoSuggestCmd);
      cmd.finalize();
      const parser = new Parser(cmd);

      try {
        parser.parse(["--xyz123"], {});
      } catch (e) {
        assertInstanceOf(e, ClepoError);
        assertEquals(e.kind, ErrorKind.UnknownArgument);
        assertEquals(e.message.includes("tip:"), false);
      }
    });
  });
});
