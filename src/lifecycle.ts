import type { Server } from "node:http";

export interface LifecycleOptions {
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: (message: string) => void;
}

export async function shutdownServer(
  server: Server,
  options: LifecycleOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const exit = options.exit ?? ((code) => process.exit(code));
  const log = options.log ?? ((m) => console.log(m));

  log("shutdown: closing HTTP server");
  const closed = new Promise<"closed">((resolve) =>
    server.close(() => resolve("closed")),
  );
  const timedOut = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), timeoutMs).unref();
  });

  if ((await Promise.race([closed, timedOut])) === "timeout") {
    log("shutdown: timed out waiting for connections, forcing exit");
    exit(1);
    return;
  }
  log("shutdown: complete");
  exit(0);
}

export function installLifecycle(
  server: Server,
  options: LifecycleOptions = {},
): void {
  const exit = options.exit ?? ((code) => process.exit(code));
  let shuttingDown = false;

  const onSignal = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`received ${signal}`);
    void shutdownServer(server, options);
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);

  process.on("unhandledRejection", (reason) => {
    console.error("unhandledRejection:", reason);
    exit(1);
  });
  process.on("uncaughtException", (err) => {
    console.error("uncaughtException:", err);
    exit(1);
  });
}
