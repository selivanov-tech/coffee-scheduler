import { describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createServer } from "../src/http/server.js";
import { shutdownServer } from "../src/lifecycle.js";

describe("shutdownServer", () => {
  it("closes a listening server and exits 0", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const exit = vi.fn();
    await shutdownServer(server, { exit, log: () => {}, timeoutMs: 1000 });

    expect(exit).toHaveBeenCalledWith(0);
    expect(server.listening).toBe(false);
  });

  it("forces exit 1 when closing does not finish before the timeout", async () => {
    const hanging = {
      close: () => hanging,
    } as unknown as Server;

    const exit = vi.fn();
    await shutdownServer(hanging, { exit, log: () => {}, timeoutMs: 20 });

    expect(exit).toHaveBeenCalledWith(1);
  });
});
