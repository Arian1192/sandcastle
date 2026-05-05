/** Minimal type declarations for @daytona/sdk (optional peer dependency). */
declare module "@daytona/sdk" {
  export interface DaytonaConfig {
    apiKey?: string;
    apiUrl?: string;
    target?: string;
  }

  export interface DaytonaProcess {
    createSession(sessionId: string): Promise<void>;
    executeSessionCommand(
      sessionId: string,
      req: { command: string; async?: boolean },
    ): Promise<{ cmdId?: string }>;
    getSessionCommandLogs(
      sessionId: string,
      commandId: string,
      onStdout: (chunk: string) => void,
      onStderr: (chunk: string) => void,
    ): Promise<void>;
    getSessionCommand(
      sessionId: string,
      commandId: string,
    ): Promise<{ exitCode?: number }>;
    deleteSession(sessionId: string): Promise<void>;
    executeCommand(
      command: string,
      cwd?: string,
    ): Promise<{ result: string; exitCode: number }>;
  }

  export interface DaytonaFs {
    uploadFile(localPath: string, remotePath: string): Promise<void>;
    downloadFile(remotePath: string, localPath: string): Promise<void>;
  }

  export interface DaytonaSandbox {
    getWorkDir(): Promise<string | undefined>;
    getUserHomeDir(): Promise<string | undefined>;
    process: DaytonaProcess;
    fs: DaytonaFs;
  }

  export class Daytona {
    constructor(config?: DaytonaConfig);
    create(options?: unknown): Promise<DaytonaSandbox>;
    delete(sandbox: DaytonaSandbox): Promise<void>;
  }
}
