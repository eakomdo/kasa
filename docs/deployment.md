# Deploying the Kasa web app

The frontend is a static build (`frontend/dist`) and can go on any CDN: Cloudflare Pages, Netlify, Vercel, S3 +
CloudFront, and so on. Choose a provider with an edge location in or near West Africa (Lagos or Accra). For most
learners, latency matters more than raw bandwidth.

## Build

```bash
cd frontend
npm ci
VITE_API_BASE_URL=https://api.kasa.example/api VITE_USE_MOCKS=false npm run build
```

## Routing

This is a single-page app. Rewrite every unknown path to `/index.html`, but never rewrite `/api/*`.

## Cache headers

| Path | Header | Why |
| --- | --- | --- |
| `/assets/*` (hashed file names) | `Cache-Control: public, max-age=31536000, immutable` | These files never change in place |
| `/sw.js`, `/index.html`, `/manifest.webmanifest` | `Cache-Control: no-cache` | So phones notice new versions |
| `/api/tts/*` (backend) | `Cache-Control: public, max-age=2592000` | Pronunciation audio is reused by thousands of learners |

## Security headers

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), geolocation=(), microphone=(self)
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.kasa.example; media-src 'self' https://api.kasa.example; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

- Microphone access is reserved for the planned speaking practice (Khaya speech recognition).
- Fonts are self-hosted, so the policy needs no third-party font hosts.

## Observability

- **Errors:** call `setErrorReporter()` in `src/main.tsx`, for example with Sentry. Route errors, unhandled promise
  rejections and API contract violations already flow through it.
- **Analytics:** call `setAnalyticsSink()`. The event catalogue is typed in `src/shared/lib/analytics.ts`, and events
  carry no personal data.
- **Feature flags:** set `VITE_FLAGS='{"mobileMoney":true}'` per environment, or replace `src/shared/config/flags.ts`
  with a remote flag service.

## Performance budget

Build output today: about 940 KB precached for offline use, including about 240 KB of fonts. The first screen loads
roughly 150 KB of JavaScript (gzip). Keep each new route chunk under 15 KB gzip. Review `npm run build` output in
every pull request.
