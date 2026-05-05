import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  copyFilesToSandbox,
  resolveCopyFilesToSandbox,
} from "./CopyFilesToSandbox.js";
import {
  createBindMountSandboxProvider,
  createIsolatedSandboxProvider,
} from "./SandboxProvider.js";
import { noSandbox } from "./sandboxes/no-sandbox.js";

const dockerLikeProvider = createBindMountSandboxProvider({
  name: "docker-like",
  sandboxHomedir: "/home/agent",
  create: async () => ({
    worktreePath: "/home/agent/workspace",
    exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    copyFileIn: async () => {},
    copyFileOut: async () => {},
    close: async () => {},
  }),
});

describe("resolveCopyFilesToSandbox", () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("returns empty array when option is omitted", () => {
    expect(resolveCopyFilesToSandbox(undefined, dockerLikeProvider)).toEqual(
      [],
    );
  });

  it("resolves hostPath relative to process.cwd()", () => {
    const dir = mkdtempSync(join(tmpdir(), "copy-files-resolve-"));
    process.chdir(dir);
    writeFileSync(join(dir, "auth.json"), "secret");

    const resolved = resolveCopyFilesToSandbox(
      [{ hostPath: "auth.json", sandboxPath: "~/.codex/auth.json" }],
      dockerLikeProvider,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.hostPath.endsWith("/auth.json")).toBe(true);
    expect(resolved[0]!.sandboxPath).toBe("/home/agent/.codex/auth.json");
  });

  it("fails when the host file does not exist", () => {
    expect(() =>
      resolveCopyFilesToSandbox(
        [{ hostPath: "./missing.json", sandboxPath: "~/.codex/auth.json" }],
        dockerLikeProvider,
      ),
    ).toThrow("copyFilesToSandbox hostPath does not exist on the host");
  });

  it("fails when sandboxPath is relative", () => {
    const dir = mkdtempSync(join(tmpdir(), "copy-files-relative-"));
    const file = join(dir, "auth.json");
    writeFileSync(file, "secret");

    expect(() =>
      resolveCopyFilesToSandbox(
        [{ hostPath: file, sandboxPath: ".codex/auth.json" }],
        dockerLikeProvider,
      ),
    ).toThrow("sandboxPath must be absolute or use '~'");
  });

  it("fails when sandboxPath escapes the sandbox home", () => {
    const dir = mkdtempSync(join(tmpdir(), "copy-files-escape-"));
    const file = join(dir, "auth.json");
    writeFileSync(file, "secret");

    expect(() =>
      resolveCopyFilesToSandbox(
        [{ hostPath: file, sandboxPath: "/tmp/auth.json" }],
        dockerLikeProvider,
      ),
    ).toThrow("only paths under /home/agent are supported");
  });

  it("fails on duplicate sandboxPath", () => {
    const dir = mkdtempSync(join(tmpdir(), "copy-files-duplicate-"));
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    writeFileSync(a, "a");
    writeFileSync(b, "b");

    expect(() =>
      resolveCopyFilesToSandbox(
        [
          { hostPath: a, sandboxPath: "~/.codex/auth.json" },
          { hostPath: b, sandboxPath: "/home/agent/.codex/auth.json" },
        ],
        dockerLikeProvider,
      ),
    ).toThrow("copyFilesToSandbox contains duplicate sandboxPath");
  });

  it("allows the same hostPath to be copied to multiple sandbox paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "copy-files-same-host-"));
    const file = join(dir, "auth.json");
    writeFileSync(file, "secret");

    expect(
      resolveCopyFilesToSandbox(
        [
          { hostPath: file, sandboxPath: "~/.codex/auth.json" },
          { hostPath: file, sandboxPath: "~/.config/codex/auth.json" },
        ],
        dockerLikeProvider,
      ),
    ).toEqual([
      {
        hostPath: file,
        sandboxPath: "/home/agent/.codex/auth.json",
      },
      {
        hostPath: file,
        sandboxPath: "/home/agent/.config/codex/auth.json",
      },
    ]);
  });

  it("fails with isolated providers", () => {
    const isolated = createIsolatedSandboxProvider({
      name: "isolated",
      create: async () => ({
        worktreePath: "/workspace",
        exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
        copyIn: async () => {},
        copyFileOut: async () => {},
        close: async () => {},
      }),
    });
    const dir = mkdtempSync(join(tmpdir(), "copy-files-isolated-"));
    const file = join(dir, "auth.json");
    writeFileSync(file, "secret");

    expect(() =>
      resolveCopyFilesToSandbox(
        [{ hostPath: file, sandboxPath: "~/.codex/auth.json" }],
        isolated,
      ),
    ).toThrow("supported only for bind-mount sandbox providers");
  });

  it("fails with noSandbox()", () => {
    const dir = mkdtempSync(join(tmpdir(), "copy-files-none-"));
    const file = join(dir, "auth.json");
    writeFileSync(file, "secret");

    expect(() =>
      resolveCopyFilesToSandbox(
        [{ hostPath: file, sandboxPath: "~/.codex/auth.json" }],
        noSandbox(),
      ),
    ).toThrow(
      "copyFilesToSandbox is not supported with the no-sandbox provider",
    );
  });
});

describe("copyFilesToSandbox", () => {
  it("creates parent directories and overwrites destination files", async () => {
    const root = mkdtempSync(join(tmpdir(), "copy-files-stage-"));
    const hostFile = join(root, "auth.json");
    const sandboxHome = join(root, "sandbox-home");
    writeFileSync(hostFile, "fresh-secret");
    mkdirSync(join(sandboxHome, ".codex"), { recursive: true });
    writeFileSync(join(sandboxHome, ".codex", "auth.json"), "stale-secret");

    const handle = {
      worktreePath: join(root, "workspace"),
      exec: async (command: string) => {
        const match = command.match(/^mkdir -p '(.*)'$/);
        if (match) {
          mkdirSync(match[1]!, { recursive: true });
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "unknown", exitCode: 1 };
      },
      copyFileIn: async (from: string, to: string) => {
        mkdirSync(dirname(to), { recursive: true });
        await copyFile(from, to);
      },
      copyFileOut: async () => {},
      close: async () => {},
    };

    await copyFilesToSandbox(handle, [
      {
        hostPath: hostFile,
        sandboxPath: join(sandboxHome, ".codex", "auth.json"),
      },
    ]);

    expect(
      readFileSync(join(sandboxHome, ".codex", "auth.json"), "utf-8"),
    ).toBe("fresh-secret");
  });
});
