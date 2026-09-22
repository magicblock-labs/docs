import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, mock, test } from "node:test";
import worker, { type Conversion, type Env } from "../src/index.ts";

const origin = "https://docs.magicblock.xyz";
const endpoint = "https://worker.example/events";
const payload = () => ({
  event: "ai_skill_cta_clicked",
  conversion_id: randomUUID(),
  conversion_time: new Date().toISOString(),
  event_source_url: origin + "/guide?unrelated=private#fragment",
  twclid: "test-click-id",
});
function environment() {
  const queued: Conversion[] = [];
  const failed: Conversion[] = [];
  const env = {
    ALLOWED_ORIGINS: origin,
    X_EVENT_ID: "tw-p9ilu-test",
    X_PIXEL_TOKEN: "test-token",
    CONVERSIONS: { send: mock.fn(async (body: Conversion) => { queued.push(body); }) },
    FAILED_CONVERSIONS: { send: mock.fn(async (body: Conversion) => { failed.push(body); }) },
    EVENT_RATE_LIMITER: { limit: mock.fn(async () => ({ success: true })) },
  } as unknown as Env;
  return { env, queued, failed };
}
function request(body: unknown = payload(), extraHeaders = {}) {
  return new Request(endpoint, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "text/plain", "CF-Connecting-IP": "192.0.2.1", "User-Agent": "test-agent", ...extraHeaders },
    body: JSON.stringify(body),
  });
}
function batch(body: Conversion) {
  const message = { body, attempts: 2, ack: mock.fn(), retry: mock.fn() };
  return { message, batch: { messages: [message] } as unknown as MessageBatch<Conversion> };
}
afterEach(() => mock.restoreAll());

test("accepts the configured action, strips query data, and keeps deduplication fields", async () => {
  const { env, queued } = environment();
  const input = { ...payload(), event_id: "attacker-event" };
  const result = await worker.fetch(request(input), env);
  assert.equal(result.status, 202);
  assert.equal(result.headers.get("Access-Control-Allow-Origin"), origin);
  assert.deepEqual(queued, [{
    event_id: "tw-p9ilu-test", conversion_id: input.conversion_id,
    conversion_time: input.conversion_time, event_source_url: origin + "/guide",
    identifiers: [{ twclid: "test-click-id" }],
  }]);
});

test("uses request IP and user agent when no click ID exists", async () => {
  const { env, queued } = environment();
  const input = { ...payload(), twclid: undefined, ip_address: "attacker-ip" };
  assert.equal((await worker.fetch(request(input), env)).status, 202);
  assert.deepEqual(queued[0].identifiers, [{ ip_address: "192.0.2.1", user_agent: "test-agent" }]);
});

test("rejects disallowed origins and malformed, oversized, stale, or unrelated events", async () => {
  const { env, queued } = environment();
  assert.equal((await worker.fetch(request(payload(), { Origin: "https://evil.example" }), env)).status, 403);
  for (const input of [null, [], { ...payload(), event: "purchase" },
    { ...payload(), conversion_id: "invalid" }, { ...payload(), twclid: "" },
    { ...payload(), event_source_url: "https://evil.example/guide" },
    { ...payload(), conversion_time: "2024-01-01T00:00:00Z" },
    { ...payload(), conversion_time: new Date(Date.now() + 120_000).toISOString() },
    { ...payload(), extra: "a".repeat(4096) },
  ]) assert.equal((await worker.fetch(request(input), env)).status, 400);
  assert.equal(queued.length, 0);
});

test("fails closed before configuration and publishes only the public event ID", async () => {
  const { env } = environment();
  const config = () => new Request("https://worker.example/config", { headers: { Origin: origin } });
  assert.deepEqual(await (await worker.fetch(config(), env)).json(), { event_id: env.X_EVENT_ID });
  delete env.X_PIXEL_TOKEN;
  assert.deepEqual(await (await worker.fetch(config(), env)).json(), { event_id: null });
  assert.equal((await worker.fetch(request(), env)).status, 503);
});

test("handles preflight, rate limits, and queue failures without reporting acceptance", async () => {
  const { env } = environment();
  const preflight = await worker.fetch(new Request(endpoint, { method: "OPTIONS", headers: { Origin: origin } }), env);
  assert.equal(preflight.status, 204);
  mock.method(env.EVENT_RATE_LIMITER, "limit", async () => ({ success: false }));
  assert.equal((await worker.fetch(request(), env)).status, 429);
  mock.restoreAll();
  mock.method(env.CONVERSIONS, "send", async () => { throw new Error("unavailable"); });
  assert.equal((await worker.fetch(request(), env)).status, 503);
});

test("sends the exact queued occurrence to X and acknowledges success", async () => {
  const { env, queued } = environment();
  await worker.fetch(request(), env);
  const { message, batch: messages } = batch(queued[0]);
  const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://ads-api.x.com/12/measurement/conversions/p9ilu");
    assert.equal(options.headers["X-Pixel-Token"], "test-token");
    assert.deepEqual(JSON.parse(options.body), { conversions: queued });
    return Response.json({ data: { conversions_processed: 1 } });
  });
  await worker.queue(messages, env);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(message.ack.mock.callCount(), 1);
  assert.equal(message.retry.mock.callCount(), 0);
});

test("retries transient failures without changing the occurrence", async () => {
  for (const status of [429, 503, 0]) {
    const { env, queued } = environment();
    await worker.fetch(request(), env);
    const original = structuredClone(queued[0]);
    const { message, batch: messages } = batch(queued[0]);
    mock.method(globalThis, "fetch", async () => {
      if (!status) throw new Error("timeout");
      return new Response(null, { status });
    });
    await worker.queue(messages, env);
    assert.equal(message.ack.mock.callCount(), 0);
    assert.deepEqual(message.retry.mock.calls[0].arguments, [{ delaySeconds: 120 }]);
    assert.deepEqual(message.body, original);
    mock.restoreAll();
  }
});

test("retains permanent rejections and API-level errors in the failure queue", async () => {
  for (const status of [400, 401, 200]) {
    const { env, queued, failed } = environment();
    await worker.fetch(request(), env);
    const { message, batch: messages } = batch(queued[0]);
    mock.method(globalThis, "fetch", async () => Response.json({ errors: [{ code: "INVALID" }] }, { status }));
    await worker.queue(messages, env);
    assert.deepEqual(failed, queued);
    assert.equal(message.ack.mock.callCount(), 1);
    mock.restoreAll();
  }
});
