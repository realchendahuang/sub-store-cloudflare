import { Hono } from "hono";
import { apiRoutes } from "./routes/api";
import { downloadRoutes } from "./routes/download";
import { applySecurityHeaders } from "./lib/http";
import { PayloadTooLargeError } from "./lib/limits";

const app = new Hono<{ Bindings: SubStoreEnv }>();

app.onError((error, c) => {
  // Oversized stored text is a client error, not a server fault, so it is not logged.
  if (error instanceof PayloadTooLargeError) {
    return c.json({ status: "failed", error: { code: 413, message: error.message } }, 413);
  }
  console.error(JSON.stringify({
    level: "error",
    method: c.req.method,
    // Only the redacted path is logged; query strings can carry tokens and are never logged.
    route: redactPath(c.req.path),
    requestId: c.req.header("cf-ray") || undefined,
    message: redactSecrets(error.message),
    stack: error.stack ? redactSecrets(error.stack) : undefined,
  }));
  return c.json(
    {
      status: "failed",
      error: {
        code: 500,
        message: "Internal server error",
      },
    },
    500,
  );
});

app.route("/api", apiRoutes);
app.route("/", downloadRoutes);
// Keep these upgrade cleanup endpoints so older browser registrations
// unregister themselves after moving to the current frontend.
app.get("/sw.js", (c) =>
  c.text("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',(event)=>event.waitUntil(self.registration.unregister()));", 200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store",
  }),
);
app.get("/registerSW.js", (c) => c.text("", 200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" }));
app.notFound((c) => c.env.ASSETS?.fetch(c.req.raw) || c.text("Not Found", 404));

export default {
  async fetch(request: Request, env: SubStoreEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const publicDownloadHosts = (env.SUB_STORE_PUBLIC_DOWNLOAD_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);

    if (publicDownloadHosts.includes(hostname) && !url.pathname.startsWith("/download/")) {
      return applySecurityHeaders(new Response("Not Found", {
        status: 404,
        headers: {
          "cache-control": "no-store",
        },
      }));
    }

    const response = await app.fetch(request, env, ctx);
    return applySecurityHeaders(response);
  },
} satisfies ExportedHandler<SubStoreEnv>;

// /download/:type/:name/:target/:token carries a share or download token in its fifth segment.
function redactPath(path: string) {
  const segments = path.split("/");
  if (segments[1] === "download") {
    for (let index = 5; index < segments.length; index += 1) segments[index] = ":token";
  }
  return segments.join("/");
}

function redactSecrets(text: string) {
  return text.replace(/([?&;]token=)[^&\s"']*/gi, "$1[redacted]");
}
