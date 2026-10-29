import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { Server } from "socket.io";
import { defineConfig, type Plugin } from "vite";

function localSocketServer(): Plugin {
  let io: Server | undefined;

  return {
    name: "kurio-local-socket-server",
    configureServer(server) {
      const httpServer = server.httpServer;
      if (!httpServer) return;

      server.middlewares.use("/__mock/socket-event", (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk: string) => {
          body += chunk;
          if (body.length > 64 * 1024) {
            response.writeHead(413).end();
            request.destroy();
          }
        });
        request.on("end", () => {
          let eventRequest: { event?: string; payload?: unknown; duplicateCount?: number };
          try {
            eventRequest = JSON.parse(body) as typeof eventRequest;
          } catch {
            response.writeHead(400).end("Invalid JSON");
            return;
          }

          if (
            !io ||
            (eventRequest.event !== "nft.updated" && eventRequest.event !== "order.updated") ||
            !eventRequest.payload ||
            typeof eventRequest.payload !== "object"
          ) {
            response.writeHead(400).end("Invalid socket event");
            return;
          }

          const count = Number.isSafeInteger(eventRequest.duplicateCount)
            ? Math.min(5, Math.max(1, eventRequest.duplicateCount ?? 1))
            : 1;
          for (let index = 0; index < count; index += 1) {
            io.emit(eventRequest.event, eventRequest.payload);
          }
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ emitted: count }));
        });
      });

      httpServer.once("listening", () => {
        io = new Server(httpServer, { cors: { origin: true } });
      });

      return () => io?.close();
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localSocketServer()],
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
          if (id.includes("socket.io") || id.includes("engine.io")) return "socket";
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        },
      },
    },
  },
});
