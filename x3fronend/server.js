const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");
const { createSiteServices } = require("./server/site-services");

const rootDir = __dirname;
const services = createSiteServices({ rootDir });

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

async function serveStatic(requestUrl, response) {
  const pathname = requestUrl.pathname === "/" ? "/x3star-landing.html" : requestUrl.pathname;
  const resolved = path.normalize(path.join(rootDir, pathname));
  if (!resolved.startsWith(rootDir)) {
    json(response, 403, { error: "Forbidden" });
    return;
  }
  try {
    const file = await fs.readFile(resolved);
    const extension = path.extname(resolved).toLowerCase();
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extension] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    json(response, 404, { error: "Not found" });
  }
}

function sse(response, handler) {
  response.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
  });
  response.write(": connected\n\n");
  const interval = setInterval(handler, 10000);
  response.on("close", () => clearInterval(interval));
}

async function routeApi(request, response, requestUrl) {
  const { pathname } = requestUrl;
  try {
    if (request.method === "GET" && pathname === "/api/site/health") {
      json(response, 200, await services.getHealth());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/dashboard") {
      json(response, 200, await services.getDashboard());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/network") {
      json(response, 200, await services.getNetwork());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/node-health") {
      json(response, 200, await services.getNodeHealth());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/governance") {
      json(response, 200, await services.getGovernance());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/staking") {
      json(response, 200, await services.getStaking());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/ledger") {
      json(response, 200, await services.getLedger());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/proofs") {
      json(response, 200, await services.getProofs());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/presale") {
      json(response, 200, await services.getPresale());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/reservations") {
      json(response, 200, await services.getReservations());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/whales") {
      json(response, 200, await services.getWhales());
      return true;
    }
    if (request.method === "GET" && pathname === "/api/site/tokenomics") {
      json(response, 200, await services.getTokenomics());
      return true;
    }
    if (request.method === "POST" && pathname === "/api/site/reservations") {
      const payload = await readRequestBody(request);
      json(response, 201, {
        data: await services.createReservation(payload),
        status: "live",
        source: "business-store",
        lastUpdated: new Date().toISOString(),
      });
      return true;
    }
    if (pathname.startsWith("/api/site/forms/")) {
      const formType = pathname.split("/").pop();
      if (request.method === "GET") {
        json(response, 200, await services.listFormRecords(formType));
        return true;
      }
      if (request.method === "POST") {
        const payload = await readRequestBody(request);
        json(response, 201, {
          data: await services.createFormRecord(formType, payload),
          status: "live",
          source: "business-store",
          lastUpdated: new Date().toISOString(),
        });
        return true;
      }
    }
    if (pathname.startsWith("/api/site/benchmarks/") && request.method === "GET") {
      const name = pathname.split("/").pop();
      json(response, 200, await services.getBenchmark(name));
      return true;
    }
    if (pathname === "/api/site/stream" && request.method === "GET") {
      const topic = requestUrl.searchParams.get("topic") || "health";
      sse(response, async () => {
        const payloadMap = {
          health: services.getHealth,
          reservations: services.getReservations,
          presale: services.getPresale,
          network: services.getNetwork,
          whales: services.getWhales,
          tokenomics: services.getTokenomics,
        };
        const producer = payloadMap[topic] || services.getHealth;
        const payload = await producer();
        response.write(`event: update\n`);
        response.write(`data: ${JSON.stringify({ topic, payload })}\n\n`);
      });
      return true;
    }
  } catch (error) {
    json(response, 500, { error: error.message });
    return true;
  }
  return false;
}

function createServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");
    if (requestUrl.pathname.startsWith("/api/site/")) {
      const handled = await routeApi(request, response, requestUrl);
      if (handled) return;
    }
    await serveStatic(requestUrl, response);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  const server = createServer();
  server.listen(port, () => {
    process.stdout.write(`x3fronend server listening on http://127.0.0.1:${port}\n`);
  });
}

module.exports = {
  createServer,
};
