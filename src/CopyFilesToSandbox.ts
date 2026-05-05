import { existsSync } from "node:fs";
import { posix } from "node:path";
import type {
  AnySandboxProvider,
  BindMountSandboxHandle,
  BindMountSandboxProvider,
  SandboxProvider,
} from "./SandboxProvider.js";
import { expandTilde, resolveHostPath } from "./mountUtils.js";

export interface CopyFileToSandbox {
  /** Path on the host. Supports absolute, tilde-expanded (~), and process.cwd()-relative paths. */
  readonly hostPath: string;
  /** Destination path inside the sandbox home. Must be absolute or use `~` — relative paths are not allowed. */
  readonly sandboxPath: string;
}

export interface ResolvedCopyFileToSandbox {
  readonly hostPath: string;
  readonly sandboxPath: string;
}

const shellEscape = (s: string): string => "'" + s.replace(/'/g, "'\\''") + "'";

const isTildePath = (p: string): boolean =>
  p === "~" || p.startsWith("~/") || p.startsWith("~\\");

const isWithin = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(`${parent}/`);

const requireBindMountProvider = (
  sandbox: SandboxProvider | AnySandboxProvider,
): BindMountSandboxProvider => {
  if (sandbox.tag === "none") {
    throw new Error(
      "copyFilesToSandbox is not supported with the no-sandbox provider",
    );
  }

  if (sandbox.tag !== "bind-mount") {
    throw new Error(
      "copyFilesToSandbox is currently supported only for bind-mount sandbox providers (e.g. docker(), podman())",
    );
  }

  if (sandbox.sandboxHomedir === undefined) {
    throw new Error(
      "copyFilesToSandbox requires a bind-mount sandbox provider with sandboxHomedir (e.g. docker(), podman())",
    );
  }

  return sandbox;
};

export const resolveCopyFilesToSandbox = (
  files: readonly CopyFileToSandbox[] | undefined,
  sandbox: SandboxProvider | AnySandboxProvider,
): ResolvedCopyFileToSandbox[] => {
  if (files === undefined || files.length === 0) return [];

  const provider = requireBindMountProvider(sandbox);
  const sandboxHomedir = posix.resolve(provider.sandboxHomedir!);
  const seenSandboxPaths = new Set<string>();

  return files.map((file) => {
    const resolvedHostPath = resolveHostPath(file.hostPath);
    if (!existsSync(resolvedHostPath)) {
      throw new Error(
        `copyFilesToSandbox hostPath does not exist on the host: ${file.hostPath}` +
          (file.hostPath !== resolvedHostPath
            ? ` (resolved to ${resolvedHostPath})`
            : "") +
          ". The file is required.",
      );
    }

    const sandboxPath = file.sandboxPath.replace(/\\/g, "/");
    if (!sandboxPath.startsWith("/") && !isTildePath(sandboxPath)) {
      throw new Error(
        `copyFilesToSandbox sandboxPath must be absolute or use '~': ${file.sandboxPath}`,
      );
    }

    const expandedSandboxPath = isTildePath(sandboxPath)
      ? expandTilde(sandboxPath, sandboxHomedir)
      : sandboxPath;
    const resolvedSandboxPath = posix.resolve(expandedSandboxPath);

    if (!isWithin(sandboxHomedir, resolvedSandboxPath)) {
      throw new Error(
        `copyFilesToSandbox sandboxPath ${JSON.stringify(file.sandboxPath)} is not allowed; only paths under ${sandboxHomedir} are supported`,
      );
    }

    if (seenSandboxPaths.has(resolvedSandboxPath)) {
      throw new Error(
        `copyFilesToSandbox contains duplicate sandboxPath: ${file.sandboxPath}`,
      );
    }
    seenSandboxPaths.add(resolvedSandboxPath);

    return {
      hostPath: resolvedHostPath,
      sandboxPath: resolvedSandboxPath,
    };
  });
};

export const copyFilesToSandbox = async (
  handle: BindMountSandboxHandle,
  files: readonly ResolvedCopyFileToSandbox[],
): Promise<void> => {
  for (const file of files) {
    const parentDir = posix.dirname(file.sandboxPath);
    const mkdirResult = await handle.exec(
      `mkdir -p ${shellEscape(parentDir)}`,
      { cwd: handle.worktreePath },
    );
    if (mkdirResult.exitCode !== 0) {
      throw new Error(
        `Failed to create sandbox directory ${parentDir}: ${mkdirResult.stderr || mkdirResult.stdout}`,
      );
    }

    await handle.copyFileIn(file.hostPath, file.sandboxPath);
  }
};
