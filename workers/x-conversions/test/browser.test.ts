import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";

const script = readFileSync(new URL("../../../x-pixel.js", import.meta.url), "utf8");
const destination = "https://docs.magicblock.gg/pages/overview/additional-information/ai-dev-skill";
const markup = `<script></script><nav aria-label="Main"><ul>
  <li class="block lg:hidden"><a id="mobile" href="${destination}"><span>Install AI Skill</span></a></li>
  <li id="topbar-cta-button"><a id="desktop" href="${destination}" target="_blank"><span>Install AI Skill</span></a></li>
  <li><a id="github" href="https://github.com/magicblock-labs">Github</a></li>
</ul></nav><main><a id="content" href="${destination}">Install AI Skill</a></main>`;

async function browser(options: { blockedConfig?: boolean; blockedStorage?: boolean; url?: string } = {}) {
  const dom = new JSDOM(markup, {
    url: options.url ?? "https://docs.magicblock.xyz/guide?twclid=ad-click-123",
    runScripts: "outside-only",
  });
  const { window } = dom;
  const requests: Array<{ url: string; options: RequestInit }> = [];
  window.fetch = async (url, init = {}) => {
    requests.push({ url, options: init });
    if (String(url).endsWith("/config")) {
      if (options.blockedConfig) throw new Error("blocked");
      return Response.json({ event_id: "tw-p9ilu-rfmj4" });
    }
    return Response.json({ accepted: true }, { status: 202 });
  };
  if (options.blockedStorage) {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("disabled"); } });
  }
  window.eval(script);
  // Prevent jsdom navigation after the tracking listener, without altering tracking behavior.
  window.document.addEventListener("click", (event) => event.preventDefault());
  window.document.addEventListener("auxclick", (event) => event.preventDefault());
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  await settle();
  const click = async (selector: string, button = 0) => {
    window.document.querySelector(selector)!.dispatchEvent(new window.MouseEvent(button === 1 ? "auxclick" : "click", { bubbles: true, cancelable: true, button }));
    await settle();
  };
  return { window, requests, click, close: () => window.close() };
}

test("desktop and mobile CTA clicks share occurrence IDs between pixel and Worker", async () => {
  const { window, requests, click, close } = await browser();
  try {
    await click("#desktop span");
    await click("#mobile span");
    const sent = requests.filter((r) => r.url.endsWith("/events"));
    const pixel = window.twq.queue.filter((args) => args[0] === "event");
    assert.equal(sent.length, 2);
    assert.equal(pixel.length, 2);
    for (let i = 0; i < sent.length; i++) {
      const body = JSON.parse(sent[i].options.body as string);
      assert.equal(body.conversion_id, pixel[i][2].conversion_id);
      assert.equal(body.twclid, "ad-click-123");
      assert.equal(body.event_source_url, "https://docs.magicblock.xyz/guide");
      assert.equal(sent[i].options.keepalive, true);
    }
    assert.notEqual(pixel[0][2].conversion_id, pixel[1][2].conversion_id);
  } finally { close(); }
});

test("ignores unrelated links and survives rerenders and repeated script execution", async () => {
  const { window, requests, click, close } = await browser();
  try {
    await click("#github");
    await click("#content");
    assert.equal(requests.filter((r) => r.url.endsWith("/events")).length, 0);
    window.eval(script);
    window.history.pushState({}, "", "/another-page");
    window.document.querySelector("#mobile")!.innerHTML = "<span>Install AI Skill</span>";
    await click("#mobile span", 1);
    const sent = requests.filter((r) => r.url.endsWith("/events"));
    assert.equal(sent.length, 1);
    assert.equal(JSON.parse(sent[0].options.body as string).twclid, "ad-click-123");
  } finally { close(); }
});

test("Worker delivery still works when config/pixel or browser storage is unavailable", async () => {
  const { requests, click, close } = await browser({ blockedConfig: true, blockedStorage: true });
  try {
    await click("#mobile");
    assert.equal(requests.filter((r) => r.url.endsWith("/events")).length, 1);
  } finally { close(); }
});

test("does not send CTA events from local development or preview origins", async () => {
  const { requests, click, close } = await browser({ url: "http://localhost:3000/guide" });
  try {
    await click("#desktop");
    assert.equal(requests.length, 0);
  } finally { close(); }
});
