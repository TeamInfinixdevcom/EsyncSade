import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(appDirectory, "dist");
const indexFile = path.join(distDirectory, "index.html");
const port = Number(process.env.PORT || 8080);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function findStaticFile(urlPath) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return { status: 400 };
  }

  const candidate = path.resolve(distDirectory, `.${decodedPath}`);
  const relativePath = path.relative(distDirectory, candidate);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return { status: 403 };
  }

  try {
    const fileInfo = await stat(candidate);
    if (fileInfo.isFile()) return { filePath: candidate, fileInfo };

    if (fileInfo.isDirectory()) {
      const directoryIndex = path.join(candidate, "index.html");
      const indexInfo = await stat(directoryIndex);
      if (indexInfo.isFile()) return { filePath: directoryIndex, fileInfo: indexInfo };
    }
  } catch {
    // Vite client routes are served by the SPA entry point below.
  }

  if (path.extname(decodedPath)) return { status: 404 };

  try {
    const indexInfo = await stat(indexFile);
    return indexInfo.isFile() ? { filePath: indexFile, fileInfo: indexInfo } : { status: 404 };
  } catch {
    return { status: 503 };
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url || "/", "http://localhost");
  } catch {
    response.writeHead(400).end();
    return;
  }

  if (requestUrl.pathname === "/healthz") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : JSON.stringify({ status: "ok" }));
    return;
  }

  const result = await findStaticFile(requestUrl.pathname);
  if (!result.filePath) {
    response.writeHead(result.status || 404).end();
    return;
  }

  const extension = path.extname(result.filePath).toLowerCase();
  const relativeAssetPath = path.relative(distDirectory, result.filePath);
  const isBuiltAsset = relativeAssetPath.startsWith(`assets${path.sep}`);
  response.writeHead(200, {
    "Cache-Control": isBuiltAsset ? "public, max-age=31536000, immutable" : "no-cache",
    "Content-Length": result.fileInfo.size,
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(result.filePath);
  stream.on("error", () => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
  stream.pipe(response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Esync Sade Cloud III escuchando en 0.0.0.0:${port}`);
});
