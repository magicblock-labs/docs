const EVENT_NAME = "ai_skill_cta_clicked";
const X_ENDPOINT = "https://ads-api.x.com/12/measurement/conversions/p9ilu";
const MAX_BODY_BYTES = 4096;

export interface Conversion {
  event_id: string;
  conversion_id: string;
  conversion_time: string;
  event_source_url: string;
  identifiers: Array<{ twclid: string } | { ip_address: string; user_agent: string }>;
}

export interface Env {
  ALLOWED_ORIGINS: string;
  X_EVENT_ID?: string;
  X_PIXEL_TOKEN?: string;
  CONVERSIONS: Queue<Conversion>;
  FAILED_CONVERSIONS: Queue<Conversion>;
  EVENT_RATE_LIMITER: RateLimit;
}

function ready(env: Env): boolean {
  return Boolean(env.X_PIXEL_TOKEN && /^tw-p9ilu-[a-zA-Z0-9]+$/.test(env.X_EVENT_ID ?? ""));
}

function response(status: number, body: unknown, origin?: string): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Vary": "Origin",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    },
  });
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function conversionFrom(body: unknown, request: Request, env: Env, origin: string): Conversion | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (input.event !== EVENT_NAME ||
      typeof input.conversion_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.conversion_id) ||
      typeof input.conversion_time !== "string" ||
      typeof input.event_source_url !== "string" || input.event_source_url.length > 2048) return null;

  const time = Date.parse(input.conversion_time);
  if (!Number.isFinite(time) || time > Date.now() + 60_000 || time < Date.now() - 3_600_000) return null;

  let source: URL;
  try { source = new URL(input.event_source_url); } catch { return null; }
  if (source.origin !== origin || source.username || source.password) return null;

  let identifiers: Conversion["identifiers"];
  if (input.twclid !== undefined) {
    if (typeof input.twclid !== "string" || !/^[a-zA-Z0-9_-]{1,512}$/.test(input.twclid)) return null;
    identifiers = [{ twclid: input.twclid }];
  } else {
    const ip = request.headers.get("CF-Connecting-IP");
    const userAgent = request.headers.get("User-Agent");
    if (!ip || !userAgent || userAgent.length > 1024) return null;
    identifiers = [{ ip_address: ip, user_agent: userAgent }];
  }

  return {
    event_id: env.X_EVENT_ID!,
    conversion_id: input.conversion_id,
    conversion_time: new Date(time).toISOString(),
    // Exclude search parameters and fragments, which can contain unrelated personal data.
    event_source_url: source.origin + source.pathname,
    identifiers,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") {
      return response(200, { ok: true, configured: ready(env) });
    }
    if (path !== "/config" && path !== "/events") return response(404, { error: "not_found" });
    const origin = request.headers.get("Origin") ?? "";
    if (!env.ALLOWED_ORIGINS.split(",").includes(origin)) return response(403, { error: "origin_not_allowed" });
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
      } });
    }
    if (path === "/config" && request.method === "GET") {
      return response(200, { event_id: ready(env) ? env.X_EVENT_ID : null }, origin);
    }
    if (path !== "/events" || request.method !== "POST") return response(405, { error: "method_not_allowed" }, origin);
    if (!ready(env)) return response(503, { error: "not_configured" }, origin);

    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return response(400, { error: "missing_client_ip" }, origin);
    if (!(await env.EVENT_RATE_LIMITER.limit({ key: ip })).success) {
      return response(429, { error: "rate_limited" }, origin);
    }
    if (!/^(application\/json|text\/plain)(;|$)/i.test(request.headers.get("Content-Type") ?? "")) {
      return response(415, { error: "unsupported_content_type" }, origin);
    }
    let body: unknown;
    try { body = await readBody(request); } catch { return response(400, { error: "invalid_body" }, origin); }
    const conversion = conversionFrom(body, request, env, origin);
    if (!conversion) return response(400, { error: "invalid_event" }, origin);
    try {
      await env.CONVERSIONS.send(conversion);
      return response(202, { accepted: true }, origin);
    } catch {
      console.error("conversion_enqueue_failed");
      return response(503, { error: "queue_unavailable" }, origin);
    }
  },

  async queue(batch: MessageBatch<Conversion>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      let result: Response;
      try {
        if (!env.X_PIXEL_TOKEN) throw new Error("missing token");
        result = await fetch(X_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Pixel-Token": env.X_PIXEL_TOKEN },
          body: JSON.stringify({ conversions: [message.body] }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        console.warn("conversion_delivery_retry");
        message.retry({ delaySeconds: Math.min(60 * 2 ** (message.attempts - 1), 3600) });
        continue;
      }
      if (result.status === 429 || result.status >= 500) {
        await result.body?.cancel();
        message.retry({ delaySeconds: Math.min(60 * 2 ** (message.attempts - 1), 3600) });
        console.warn(JSON.stringify({ outcome: "retry", status: result.status }));
        continue;
      }
      const body = await result.json().catch(() => null) as { errors?: unknown[] } | null;
      if (result.ok && !body?.errors?.length) {
        message.ack();
        console.log("conversion_delivered");
      } else {
        // Keep rejected events for inspection instead of repeatedly sending invalid data.
        await env.FAILED_CONVERSIONS.send(message.body);
        message.ack();
        console.error(JSON.stringify({ outcome: "rejected", status: result.status }));
      }
    }
  },
};
