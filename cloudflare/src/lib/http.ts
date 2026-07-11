import type { Context } from "hono";
export function success(c: Context<{ Bindings: SubStoreEnv }>, data: unknown) {
  return c.json({ status: "success", data });
}

export function failed(c: Context<{ Bindings: SubStoreEnv }>, message: string, status = 400) {
  return c.json(
    {
      status: "failed",
      error: {
        code: status,
        message,
      },
    },
    status as 400,
  );
}

export async function isTokenValid(secret: string | undefined, input: string | undefined) {
  if (!secret) return false;
  if (!input) return false;

  const encoder = new TextEncoder();
  const [inputDigest, secretDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(input)),
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
  ]);
  return crypto.subtle.timingSafeEqual(inputDigest, secretDigest);
}

export function getBearerToken(c: Context<{ Bindings: SubStoreEnv }>) {
  const authorization = c.req.header("authorization") || "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1] || c.req.query("token") || c.req.header("x-sub-store-token");
}

export async function requireAdmin(c: Context<{ Bindings: SubStoreEnv }>) {
  if (await isTokenValid(c.env.SUB_STORE_ADMIN_TOKEN, getBearerToken(c))) return undefined;
  return failed(c, "Admin token is invalid", 401);
}

export function applyCorsHeaders(response: Response, origin: string | undefined, allowedOrigins = "") {
  const headers = new Headers(response.headers);
  const allowlist = allowedOrigins
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (origin && (allowlist.includes("*") || allowlist.includes(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Sub-Store-Token");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function applySecurityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'",
  );
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
