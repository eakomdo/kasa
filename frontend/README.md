# Kasa web app

React 19 + TypeScript + Vite. It installs on phones as a Progressive Web App and works offline. It is built for
students on low-cost Android phones with expensive, patchy data, and it also has a full desktop layout for school
computer labs.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173, using the built-in mock backend
npm run check        # typecheck + lint + tests (run before every commit)
npm run build        # production build in dist/, with the service worker
npm run preview      # serve the production build locally
```

Sample accounts (mock mode only; the password for all of them is `demo1234`). The Welcome screen also has one-tap
buttons for these.

| Email                    | Role                                                    |
| ------------------------ | ------------------------------------------------------- |
| ama.mensah@example.com   | JHS 1 student learning Twi, with a few days of progress |
| kojo.boateng@example.com | Verified teacher                                        |
| yaw.darko@example.com    | Moderator                                               |
| efua.asante@example.com  | Admin                                                   |

## Switching to the real backend

Set these in `.env.production` (or `.env.local`):

```
VITE_API_BASE_URL=https://api.kasa.example/api
VITE_USE_MOCKS=false
```

No feature code changes. Every request goes through `src/shared/api/client.ts`. When mocks are on, the client
answers from `src/shared/api/mock/`, which is lazy-loaded, so it adds nothing to the bundle when mocks are off. The
endpoints, their shapes and their rules are documented in [`../docs/api-contract.md`](../docs/api-contract.md).

## Architecture

```
src/
  app/            App shell, router, providers, PWA registration, error pages
  features/       One folder per product area; each owns its api.ts, components, pages and styles
    auth/         Session store, login, register, route guards
    onboarding/   Language → class → daily goal → school (plus guardian email for primary pupils)
    home/         Dashboard
    curriculum/   Units and unit detail, offline saving
    practice/     Session state machine, three modes, offline answer outbox
    lookup/       Khaya-backed translation, suggestions
    progress/     Profile, badges, leaderboards
    settings/     Account settings and device preferences
    audio/        Pronunciation player (native recording first, Khaya text-to-speech second)
    community/    Forum: categories, threads, replies, votes, accepted answers, reports
    admin/        Community admin: overview, report queue, translation review, users
  shared/
    api/          HTTP client, Zod schemas (the API contract), query keys, mock backend
    config/       Languages, GES levels, regions, env
    lib/          Pure logic: spaced repetition, answer grading, dates, hooks
    ui/           Design-system components (Button, Card, Form, Dialog, Toast…)
  styles/         Design tokens and global CSS
```

### Rules of the road

- **Server state lives in TanStack Query. Client state lives in Zustand.** The session (token and cached user),
  device preferences and the offline answer outbox are the only Zustand stores.
- **Every response is validated with Zod.** If the backend breaks the contract, the app shows a clear error instead
  of rendering wrong data.
- **Features don't import from each other's internals**, except through their `api.ts` and exported components.
  Shared code goes in `shared/`.
- **Pages are lazy-loaded** (`app/router.tsx`), so a learner downloads only the screens they open.
- **Styles use CSS Modules and the tokens** in `styles/tokens.css`. Never hard-code colours. Every colour has light
  and dark values.
- **Copy is warm, plain and specific.** Errors say what went wrong and how to fix it. Twi and Ga text gets a `lang`
  attribute (`tw` or `gaa`) so screen readers pronounce it properly.

### Offline-first

- The service worker (Workbox, via `vite-plugin-pwa`) precaches the app shell and fonts. It caches curriculum API
  responses with stale-while-revalidate and pronunciation audio with cache-first.
- The query cache persists to `localStorage`, so the last-seen data opens instantly without a connection. "Save for
  offline" on a unit prefetches it into that cache.
- Answers recorded offline wait in `features/practice/outbox.ts` and are sent in order when the phone reconnects.
  Each answer carries a `clientId`, so retries never double-count.
- When a new version is ready, the app asks before reloading, so it never interrupts a practice session.

### Fonts

Libre Baskerville (headings and featured words) and Source Sans 3 (interface) are self-hosted through Fontsource.
Both include ɛ ɔ ŋ Ɛ Ɔ Ŋ. Most popular web fonts do not, so check any replacement for these letters before using it.

## Testing

- `src/shared/lib/*.test.ts`: spaced repetition and answer grading
- `src/features/practice/model/session.test.ts`: the practice state machine
- `src/shared/api/mock/mockApi.test.ts` and `src/features/community/community.server.test.ts`: contract tests for the
  backend rules (auth, idempotent attempts, lookup order, moderation, permissions)
- Component tests use Testing Library with the mock backend (`src/test/render.tsx`)

## Adding a language

1. Add an entry to `shared/config/languages.ts`, with its Khaya codes, special letters, praise words and weekday
   labels.
2. Add curriculum on the server. Mark it `review` until native-speaking teachers sign it off.
3. Check the fonts cover the new letters.
