// loru/packages/clepo/tests/integration_test.ts

import { assertEquals, assertInstanceOf, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Arg as ArgClass, ArgAction } from "../arg.ts";
import { Command, CommandSettings } from "../command.ts";
import { Arg, Command as CommandDecorator, getCommand, Subcommand } from "../decorators.ts";
import { ClepoError, ErrorKind } from "../error.ts";
import { HelpGenerator } from "../help.ts";
import { Parser } from "../parser.ts";

// --- Decorated Classes for Testing ---

@CommandDecorator({
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

@CommandDecorator({
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
@CommandDecorator({
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
@CommandDecorator({
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
@CommandDecorator({
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
@CommandDecorator({
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
@CommandDecorator({
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
@CommandDecorator({
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
      const freshAddCommand = new Command("add")
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

      const freshGitCommand = new Command("git")
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
      @CommandDecorator({
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
      @CommandDecorator({
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

      const subCmd = new Command("sub");
      subCmd.cls = SubCmd;

      class ParentBuilder {
        command?: SubCmd;
        run(): Promise<void> {
          return Promise.resolve();
        }
      }

      const parentCmd = new Command("parent")
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
});
