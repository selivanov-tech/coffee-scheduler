import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

export type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse,
) => void | Promise<void>;

export interface ServerOptions {
  onWebhook?: RequestHandler;
}

export function createServer(options: ServerOptions = {}): Server {
  return createHttpServer((req, res) => {
    void route(options, req, res).catch((err: unknown) => {
      console.error("request failed:", err);
      if (!res.headersSent) sendText(res, 500, "internal error");
    });
  });
}

async function route(
  options: ServerOptions,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method ?? "GET";
  const path = (req.url ?? "/").split("?", 1)[0];

  if (method === "GET" && path === "/health") {
    sendText(res, 200, "ok");
    return;
  }
  if (method === "POST" && path === "/webhook" && options.onWebhook) {
    await options.onWebhook(req, res);
    return;
  }
  sendText(res, 404, "not found");
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(body);
}
