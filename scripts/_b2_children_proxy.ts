// _b2_children_proxy.ts — minimal fault-injection proxy for B2 (/children fallback test)
// Forwards all requests to UPSTREAM except /session/{sid}/children, which it faults
// per B2_MODE (404 | html | nonjson). Used by session-tree.ts to exercise DB fallback.

const UPSTREAM = process.env.B2_UPSTREAM || "http://127.0.0.1:4096";
const MODE = (process.env.B2_MODE || "404").toLowerCase();
const PORT = Number(process.env.B2_PORT || 5097);

const server = Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // Fault-inject ONLY the /children endpoint
    if (path.endsWith("/children")) {
      if (MODE === "404") {
        return new Response("Not Found", { status: 404 });
      }
      if (MODE === "html") {
        return new Response(
          "<html><body><h1>502 Bad Gateway</h1><p>upstream unavailable</p></body></html>",
          { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      }
      // nonjson: valid 200 but non-JSON body
      return new Response("children temporarily unavailable (plain text)", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Forward everything else (node-info, root) to the real serve
    const upstreamUrl = UPSTREAM + path + (url.search || "");
    const upstreamReq = new Request(upstreamUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    const res = await fetch(upstreamReq);
    return new Response(res.body, {
      status: res.status,
      headers: res.headers,
    });
  },
});

console.log(`B2 proxy listening on :${server.port} mode=${MODE} upstream=${UPSTREAM}`);
