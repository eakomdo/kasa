# Kasa

Kasa helps Ghanaian students learn Ghanaian languages the way the GES curriculum teaches them. It starts with Twi
and Ga and covers every class from Basic 1 to SHS 3. It is built for low-cost Android phones and expensive data:
it installs from the browser, works offline, and keeps downloads small.

| Folder | What's in it |
| --- | --- |
| [`frontend/`](frontend/) | The web app: React, TypeScript, an installable PWA, with a built-in mock backend. See [`frontend/README.md`](frontend/README.md). |
| [`docs/api-contract.md`](docs/api-contract.md) | Every endpoint, shape and rule the backend must implement |
| [`docs/roadmap.md`](docs/roadmap.md) | What's built, and what comes next |
| [`../kasa-api`](../kasa-api) | The Django + DRF API (separate project folder) |

## Run it

```bash
cd frontend
npm install
npm run dev     # open http://localhost:5173 and pick a sample account on the Welcome screen
```

## What's in the app

**For learners**
- Sign-up and onboarding: choose a language, a class (Basic 1 to SHS 3, with JHS shown as Basic 7–9), a daily goal,
  and a school and region. Primary pupils add a parent or guardian's email.
- Spaced-repetition practice in three modes: flashcards, exam-style multiple choice (labelled "BECE style" or
  "WASSCE style" by level), and typing with on-screen ɛ ɔ ŋ keys. Spellings typed with e, o or n instead of ɛ, ɔ or ŋ
  count as "almost".
- A unit browser with native-speaker or Khaya AI audio, a culture note for each unit, and saving for offline use.
- Phrase lookup in both directions. Each answer is labelled either teacher-verified or Khaya AI, and learners can
  suggest corrections.
- Streaks, XP, Adinkra-named badges, and weekly leaderboards by school, region and nationally.
- Answers recorded offline sync later. The app has a data saver, a light and dark theme, and works with a keyboard
  in school computer labs.

**Communities**
- Six official Kasa communities (Twi help, Ga help, BECE and WASSCE prep, culture, pronunciation, announcements),
  plus communities that teachers, schools and students start themselves.
- Anyone can propose a community. Kasa staff communities go live at once; everyone else's wait for a Kasa moderator
  to approve them.
- Each community chooses how people join: **open** (one tap), **ask to join** (helpers or admins approve each
  request), or **class code** (for example `ASF-7B`, or a link like `/community/join?code=ASF-7B`).
- Roles inside a community: owner, admin (teachers and Kasa staff only), helper (can be a student: approves
  requests, pins posts) and member. Students never get remove or ban powers; they report problems to Kasa.
- Votes, accepted answers, verified teacher badges and notifications.
- Child-safety rules: no direct messages, no profile pages, phone numbers, emails, links and insults blocked
  automatically, rate limits, and reporting.

**Community admin**
- An overview of learners, sign-ups, languages and regions.
- A report queue: dismiss, remove, warn or suspend.
- A community approval queue: approve, reject with a reason the creator sees, or archive.
- Translation review. An approved suggestion becomes a teacher-verified lookup answer.
- People management: roles and suspensions.
