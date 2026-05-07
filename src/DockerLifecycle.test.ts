import { afterEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));

import { execFile } from "node:child_process";
import { startContainer, buildImage } from "./DockerLifecycle.js";

const mockExecFile = vi.mocked(execFile);

afterEach(() => {
  mockExecFile.mockReset();
});

describe("buildImage", () => {
  it("passes --build-arg flags when buildArgs is provided", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
      cb(null, "", "");
      return undefined as any;
    });

    await Effect.runPromise(
      buildImage("my-image", "/tmp/dir", {
        buildArgs: { AGENT_UID: "1001", AGENT_GID: "1001" },
      }),
    );

    const buildCall = mockExecFile.mock.calls.find(
      ([, args]) => Array.isArray(args) && args[0] === "build",
    );
    expect(buildCall).toBeDefined();
    const buildArgs = buildCall![1] as string[];
    const uidIdx = buildArgs.indexOf("--build-arg");
    expect(uidIdx).toBeGreaterThan(-1);
    expect(buildArgs[uidIdx + 1]).toBe("AGENT_UID=1001");
    const gidIdx = buildArgs.indexOf("--build-arg", uidIdx + 1);
    expect(gidIdx).toBeGreaterThan(-1);
    expect(buildArgs[gidIdx + 1]).toBe("AGENT_GID=1001");
  });

  it("does not pass --build-arg flags when buildArgs is omitted", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
      cb(null, "", "");
      return undefined as any;
    });

    await Effect.runPromise(buildImage("my-image", "/tmp/dir"));

    const buildCall = mockExecFile.mock.calls.find(
      ([, args]) => Array.isArray(args) && args[0] === "build",
    );
    const buildArgs = buildCall![1] as string[];
    expect(buildArgs).not.toContain("--build-arg");
  });
});

describe("startContainer", () => {
  it("passes --network flag when network is a string", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
      cb(null, "", "");
      return undefined as any;
    });

    await Effect.runPromise(
      startContainer("ctr", "img", {}, { network: "my-network" }),
    );

    const runCall = mockExecFile.mock.calls.find(
      ([, args]) => Array.isArray(args) && args[0] === "run",
    );
    expect(runCall).toBeDefined();
    const runArgs = runCall![1] as string[];
    const networkIdx = runArgs.indexOf("--network");
    expect(networkIdx).toBeGreaterThan(-1);
    expect(runArgs[networkIdx + 1]).toBe("my-network");
  });

  it("passes multiple --network flags when network is an array", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
      cb(null, "", "");
      return undefined as any;
    });

    await Effect.runPromise(
      startContainer("ctr", "img", {}, { network: ["net1", "net2"] }),
    );

    const runCall = mockExecFile.mock.calls.find(
      ([, args]) => Array.isArray(args) && args[0] === "run",
    );
    const runArgs = runCall![1] as string[];
    const firstIdx = runArgs.indexOf("--network");
    expect(firstIdx).toBeGreaterThan(-1);
    expect(runArgs[firstIdx + 1]).toBe("net1");
    const secondIdx = runArgs.indexOf("--network", firstIdx + 1);
    expect(secondIdx).toBeGreaterThan(-1);
    expect(runArgs[secondIdx + 1]).toBe("net2");
  });

  it("does not pass --network when network is omitted", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
      cb(null, "", "");
      return undefined as any;
    });

    await Effect.runPromise(startContainer("ctr", "img", {}));

    const runCall = mockExecFile.mock.calls.find(
      ([, args]) => Array.isArray(args) && args[0] === "run",
    );
    const runArgs = runCall![1] as string[];
    expect(runArgs).not.toContain("--network");
  });

  it("uses --mount type=bind format instead of -v for volume mounts", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
      cb(null, "", "");
      return undefined as any;
    });

    await Effect.runPromise(
      startContainer(
        "ctr",
        "img",
        {},
        {
          volumeMounts: [
            { hostPath: "/host/path", sandboxPath: "/sandbox/path" },
          ],
        },
      ),
    );

    const runCall = mockExecFile.mock.calls.find(
      ([, args]) => Array.isArray(args) && args[0] === "run",
    );
    const runArgs = runCall![1] as string[];
    expect(runArgs).not.toContain("-v");
    expect(runArgs).toContain("--mount");
    const mountIdx = runArgs.indexOf("--mount");
    expect(runArgs[mountIdx + 1]).toBe(
      "type=bind,source=/host/path,target=/sandbox/path",
    );
  });

  it("handles Windows-style host paths with colons correctly", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
      cb(null, "", "");
      return undefined as any;
    });

    await Effect.runPromise(
      startContainer(
        "ctr",
        "img",
        {},
        {
          volumeMounts: [
            {
              hostPath: "C:/Users/x/repo",
              sandboxPath: "/home/agent/workspace",
            },
          ],
        },
      ),
    );

    const runCall = mockExecFile.mock.calls.find(
      ([, args]) => Array.isArray(args) && args[0] === "run",
    );
    const runArgs = runCall![1] as string[];
    expect(runArgs).not.toContain("-v");
    const mountIdx = runArgs.indexOf("--mount");
    expect(runArgs[mountIdx + 1]).toBe(
      "type=bind,source=C:/Users/x/repo,target=/home/agent/workspace",
    );
  });

  it("includes readonly flag for read-only mounts", async () => {
    mockExecFile.mockImplementation((_cmd, _args, _opts, cb: any) => {
      cb(null, "", "");
      return undefined as any;
    });

    await Effect.runPromise(
      startContainer(
        "ctr",
        "img",
        {},
        {
          volumeMounts: [
            {
              hostPath: "/host/path",
              sandboxPath: "/sandbox/path",
              readonly: true,
            },
          ],
        },
      ),
    );

    const runCall = mockExecFile.mock.calls.find(
      ([, args]) => Array.isArray(args) && args[0] === "run",
    );
    const runArgs = runCall![1] as string[];
    const mountIdx = runArgs.indexOf("--mount");
    expect(runArgs[mountIdx + 1]).toBe(
      "type=bind,source=/host/path,target=/sandbox/path,readonly",
    );
  });
});
