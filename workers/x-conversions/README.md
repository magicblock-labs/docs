# X conversions for the docs

Tracks two clicks as one X event: the **Install AI Skill** button in the main
navigation (including its mobile variant), and the copy button of the
`npx skills add .../magicblock-dev-skill` command in the AI Dev Skill callout
(`snippets/ai-dev-skill-callout.mdx`). Both are intent signals, not a confirmed
skill installation. Other links to the guide and other code blocks are excluded.

- Worker: `magicblock-docs-conversions`
- Endpoint: `https://tracking.magicblock.app`
- Pixel: `p9ilu`
- X Custom event: `tw-p9ilu-rfmj4`
- Internal action: `ai_skill_cta_clicked`

## Flow

The root `x-pixel.js` installs the base pixel and a delegated click listener. It
reads the public event ID from `GET /config`, then reports each click through
the pixel and `POST /events` with the same generated `conversion_id`.
The browser sends its request with `keepalive`, without delaying navigation.
No browser retries are made; delivery from the browser remains best effort.
If config cannot load, the Worker request can still be sent independently.

The Worker validates the event and writes it to a Cloudflare Queue before
returning `202`. Its queue handler sends the original occurrence to X:

```text
POST https://ads-api.x.com/12/measurement/conversions/p9ilu
X-Pixel-Token: <Worker secret>
```

Transient failures (network errors, HTTP 429 and 5xx) retry up to five times with
exponential delays. Retries retain the event ID, conversion ID, and timestamp.
Permanent API rejections go directly to the failed queue; exhausted retries go
there through the dead-letter binding. Each message is acknowledged separately.
Both queues use one-day retention. Inspect failed messages promptly, correct the
cause, and replay the original payload; do not generate a new conversion ID.
X performs pixel/API deduplication; the Worker does not provide a database of
unique visitors or an exactly-once delivery guarantee.

`twclid` is captured on arrival and retained in tab-scoped session storage, when
available. Redirects must preserve it for the browser to capture it. When there
is no click ID, the Worker uses the incoming `CF-Connecting-IP` and `User-Agent`.
Source URL queries/fragments are removed. Tokens and visitor identifiers are not
written to application logs, but identifiers are necessarily retained in queued
payloads until delivery or queue expiry.

Requests must come from an allowed docs origin and match the fixed action. A
per-IP limit allows 120 events/minute per Cloudflare location, which can affect
visitors sharing an IP. Origin checks and rate limiting reduce abuse but do not
authenticate visitors or prove a real click; requests can be forged.
The existing base pixel remains unchanged. If a consent manager is introduced,
gate both the base pixel and custom tracking through it.

## Local checks

```sh
cd workers/x-conversions
npm ci
npm run check
npm test
npx wrangler deploy --dry-run --outdir /tmp/x-conversions-build
```

The browser tests use desktop/mobile markup checked against the live Mintlify
page and mock all network calls. Worker tests mock X and queues. These checks do
not create real X conversions. Use `npm run dev` for local Worker development;
production origins are configured in `wrangler.jsonc`.

Worker source/tests use TypeScript because Mintlify automatically includes
content-directory `.js` files on pages. Dependencies and `.wrangler` output are
gitignored; generated bundles go outside the docs content directory. Do not add
compiled Worker JavaScript to this repository.

## Configuration and deployment

`X_EVENT_ID` and `ALLOWED_ORIGINS` are public configuration in `wrangler.jsonc`.
Store `X_PIXEL_TOKEN` only as a Worker secret:

```sh
npx wrangler secret put X_PIXEL_TOKEN
```

The secret is preserved across normal deployments. `GET /health` reports
`configured: false` until both the event ID and token exist; this checks presence,
not whether X accepts them. An unconfigured Worker rejects events with `503` and
returns `event_id: null` from `/config`.

For initial provisioning in a new Cloudflare account:

```sh
npx wrangler queues create magicblock-docs-conversions-failed --message-retention-period-secs 86400
npx wrangler queues create magicblock-docs-conversions --message-retention-period-secs 86400
npm run deploy
npx wrangler secret put X_PIXEL_TOKEN
```

The `tracking.magicblock.app` custom domain is configured in `wrangler.jsonc`;
Cloudflare manages its DNS and TLS. The `workers.dev` and preview URLs are disabled.
If the Worker URL changes, update the endpoint in root `x-pixel.js` too.

`.github/workflows/deploy-x-conversions.yml` runs type checks, tests, and a
Wrangler build for relevant PRs. Pushes/merges to `main` that change this Worker,
`x-pixel.js`, or its workflow deploy after checks pass. Manual dispatch can deploy
`main` as well. Production deployments are serialized without cancelling one
in progress. Docs publication remains managed separately by Mintlify.

The GitHub repository must contain these Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`: the target Cloudflare account.
- `CLOUDFLARE_API_TOKEN`: deployment token with Workers Scripts Edit and Queues
  Edit on the account, plus Zone Read and Workers Routes Edit for `magicblock.app`
  to manage the custom domain.

The X token is not stored in GitHub Actions. Do not commit `.dev.vars`, tokens,
or queue dumps. To verify release readiness, check `/health`, the allowed-origin
`/config` response, CI, and a real CTA event in X Events Manager. Successful API
delivery does not guarantee attribution to an ad.

## References

- [X conversion tracking and deduplication](https://business.x.com/en/help/campaign-measurement-and-analytics/conversion-tracking-for-websites)
- [Cloudflare queue retries](https://developers.cloudflare.com/queues/configuration/batching-retries/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
