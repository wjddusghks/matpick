// Development-only durable inbox. Never bundled or used by Vercel functions.
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const storeModule = require.resolve(
  "../../api/restaurants/_suggestionStore.js"
);
const handlerModule = require.resolve("../../api/restaurants/_suggestions.js");
const retentionMs = 180 * 86400000;
const fail = (message, status) => {
  throw Object.assign(new Error(message), { status });
};

export function createLocalSuggestionStore(file) {
  let pending = Promise.resolve();
  function transaction(run) {
    const result = pending.then(async () => {
      let items;
      try {
        items = JSON.parse(await readFile(file, "utf8"));
        if (!Array.isArray(items)) throw new Error("Invalid inbox");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        items = [];
      }
      items = items.filter(item => item.createdAt > Date.now() - retentionMs);
      const value = run(items);
      await mkdir(path.dirname(file), { recursive: true });
      const temp = `${file}.tmp`;
      await writeFile(temp, JSON.stringify(items, null, 2), { mode: 0o600 });
      await rename(temp, file);
      return value;
    });
    pending = result.catch(() => {});
    return result;
  }
  return {
    validateSuggestion: input => require(storeModule).validateSuggestion(input),
    saveSuggestion(input) {
      return transaction(items => {
        const fingerprint = createHash("sha256")
          .update(JSON.stringify(input))
          .digest("hex");
        let item = items.find(row => row.requestId === input.requestId);
        if (item && item.fingerprint !== fingerprint)
          fail(
            "이미 접수된 제보입니다. 다른 식당은 새 제보로 작성해 주세요.",
            409
          );
        if (!item) {
          item = {
            ...input,
            id: randomUUID(),
            status: "pending",
            createdAt: Date.now(),
            fingerprint,
          };
          items.push(item);
        }
        return {
          id: item.id,
          status: item.status,
          createdAt: item.createdAt,
          storage: "local",
        };
      });
    },
    listSuggestions(page = 0) {
      return transaction(items => ({
        items: [...items]
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(page * 50, (page + 1) * 50)
          .map(({ fingerprint, ...item }) => item),
        total: items.length,
        page,
        pageSize: 50,
      }));
    },
    updateSuggestion(requestId, status) {
      return transaction(items => {
        if (!["pending", "reviewed", "archived"].includes(status))
          fail("처리 상태를 확인해 주세요.", 400);
        const item = items.find(row => row.requestId === requestId);
        if (!item) fail("제보를 찾을 수 없습니다.", 404);
        item.status = status;
        item.reviewedAt = Date.now();
      });
    },
  };
}

export function localSuggestionsPlugin() {
  return {
    name: "local-suggestions-api",
    apply: "serve",
    config(config) {
      return {
        server: {
          fs: {
            deny: [
              ...(config.server?.fs?.deny || [
                ".env",
                ".env.*",
                "*.{crt,pem}",
                "**/.git/**",
              ]),
              "**/.local-data/**",
            ],
          },
        },
      };
    },
    configureServer(server) {
      // CommonJS API modules outlive Vite's config reload unless invalidated.
      delete require.cache[storeModule];
      delete require.cache[handlerModule];
      const store = createLocalSuggestionStore(
        path.resolve(
          server.config.envDir,
          ".local-data/restaurant-suggestions.json"
        )
      );
      let handler = require(handlerModule).createSuggestionHandler(store);
      server.watcher.add([storeModule, handlerModule]);
      const reload = file => {
        if (
          ![storeModule, handlerModule].some(
            module => path.resolve(module) === path.resolve(file)
          )
        )
          return;
        delete require.cache[storeModule];
        delete require.cache[handlerModule];
        handler = require(handlerModule).createSuggestionHandler(store);
      };
      server.watcher.on("change", reload);
      server.httpServer?.once("close", () =>
        server.watcher.off("change", reload)
      );
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        if (
          url.pathname !== "/api/restaurants" ||
          url.searchParams.get("scope") !== "suggestions"
        )
          return next();
        // This local inbox is private to the developer's machine, even with --host.
        const address = req.socket.remoteAddress;
        if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "로컬 접수함은 이 컴퓨터에서만 사용할 수 있어요.",
            })
          );
          return;
        }
        try {
          const chunks = [];
          let length = 0;
          for await (const chunk of req) {
            length += chunk.length;
            if (length > 24000) {
              res.writeHead(413, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: "내용이 너무 길어요. 짧게 정리해 주세요.",
                })
              );
              return;
            }
            chunks.push(chunk);
          }
          req.body = chunks.length
            ? Buffer.concat(chunks).toString("utf8")
            : undefined;
          req.query = Object.fromEntries(url.searchParams);
          // Origin checks must reflect the real local HTTP connection.
          req.headers["x-forwarded-proto"] = req.socket.encrypted
            ? "https"
            : "http";
          delete req.headers["x-forwarded-host"];
          req.headers["x-forwarded-for"] = address;
          res.status = code => {
            res.statusCode = code;
            return res;
          };
          res.json = value => {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(value));
            return res;
          };
          await handler(req, res);
        } catch {
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              error: "로컬 접수함에 저장하지 못했어요. 입력 내용은 유지됩니다.",
            })
          );
        }
      });
    },
  };
}
