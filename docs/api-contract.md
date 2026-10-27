# Kasa API contract (v1)

This is the agreement between the Kasa web app and the backend. The frontend validates every response against
`frontend/src/shared/api/schemas.ts` (Zod), so that file is the machine-readable source of truth. This document
explains it for the backend team.

The in-browser mock backend (`frontend/src/shared/api/mock/`) already implements every endpoint below, including the
permission and validation rules. `frontend/src/shared/api/mock/mockApi.test.ts` and
`frontend/src/features/community/community.server.test.ts` describe the expected behaviour as tests. Port them as
the Django acceptance tests.

## Conventions

| Topic | Rule |
| --- | --- |
| Base URL | `/api` (configurable with `VITE_API_BASE_URL`) |
| JSON casing | camelCase. In Django use `djangorestframework-camel-case`. |
| Auth | `Authorization: Token <token>` (DRF `TokenAuthentication` or Knox) |
| Dates | ISO 8601 strings. Calendar days are `YYYY-MM-DD` in `Africa/Accra` (UTC+0, no DST). |
| Trailing slashes | Always, matching Django defaults |
| Errors | `{"detail": "message"}` for general errors and `{"field": ["message"]}` for validation errors. Messages are shown to students as written, so keep them plain, specific and friendly. |
| Status codes | 400 validation, 401 not logged in, 403 not allowed or suspended, 404 missing, 429 rate limited, 5xx server |
| Pagination | `{ items, total, page, pageSize }` with `?page=&pageSize=` (admin lists). Community feeds use `{ items, nextCursor }`. |

## Roles

| Role | Can |
| --- | --- |
| `student` | Learn, practise, look up, post in the community, vote, report |
| `teacher` | Everything a student can, plus mark accepted answers on any thread. Shown with a verified Teacher chip. |
| `moderator` | Everything a teacher can, plus the admin area: reports, translation suggestions, suspending students, pinning and locking threads |
| `admin` | Everything, plus changing user roles |

A `suspended` user can still learn and practise, but every community write returns 403.

## Auth and profile

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/register/` | `{name, email, password}` (password at least 8 characters) | `{token, user}` |
| POST | `/auth/login/` | `{email, password}` | `{token, user}` |
| POST | `/auth/logout/` | — | `{ok: true}` |
| GET | `/me/` | — | `User` |
| PATCH | `/me/` | any of `name, lang, levelId, dailyGoal (5/10/20/30), voice, school, region, guardianEmail, reminder, onboarded` | `User` |

`User.displayName` is "First L." (for example "Ama M."). It is the only name other learners ever see. Never expose
email, full name or guardian email to other users.

`levelId` is one of `b1`–`b9` or `shs1`–`shs3`. JHS 1–3 are `b7`–`b9` (Basic 7–9). Pupils in `b1`–`b6` must have a
`guardianEmail` before onboarding completes, because they are usually under 13.

## Curriculum

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/levels/{levelId}/units/?lang=twi` | `Unit[]` for the level's band (Lower Primary, Upper Primary, JHS, SHS), including the user's progress |
| GET | `/units/{unitId}/` | `Unit` |
| GET | `/units/{unitId}/vocabulary/` | `VocabItem[]` (`kind: "word"`) |
| GET | `/units/{unitId}/phrases/` | `VocabItem[]` (`kind: "phrase"`) |
| GET | `/daily-feature/?lang=twi` | `{kicker, local, english}`: a proverb or cultural note of the day |

- `Unit.contentStatus` is `verified` when native-speaking teachers have signed it off, and `review` otherwise. The UI
  warns learners about content in review.
- `Unit.progress.learned` counts words at mastery 2 or higher.
- `VocabItem.mastery` is the user's mastery (0–5), or `null` if the word has never been practised.
- `VocabItem.audioUrl` points to a native-speaker recording, or is `null`. When it is `null`, the app plays
  `GET /tts/` instead.

## Practice and progress

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/practice/next-batch/?lang&level&unit&limit` | `{cards: PracticeCard[]}`. Due words first (oldest due first), then new words in unit order. With `unit`, fill up with that unit's weakest words. Each card has 3 `distractors` (same language and kind, preferably the same unit, never equal to the answer) and `isNew`. |
| POST | `/practice/attempt/` | `{clientId, itemId, correct, mode, answeredAt}` → `{itemId, mastery, nextReviewAt}`. **Idempotent by `clientId`**: phones resend answers recorded offline, so a repeated `clientId` returns the stored result without counting twice. Count the attempt on the day of `answeredAt`, not the day it arrives. |
| POST | `/practice/deck/` | `{itemId}` → `VocabItem`. Adds a word to the learner's review pool (used by Lookup). |
| GET | `/progress/summary/?lang` | `ProgressSummary`: streak, longest streak, learned, mastered, due and new counts, today's count, total reviewed, XP this week, last 14 days of activity, badges |

### Spaced repetition (`frontend/src/shared/lib/srs.ts`)

- Mastery runs from 0 to 5. A correct answer sets mastery to `min(m + 1, 5)` and schedules the next review
  `[0, 1, 3, 7, 14, 30][mastery]` days out.
- A wrong answer sets mastery to 1 (or keeps it at 0 for a brand-new word) and makes the word due immediately.
- "Learned" means mastery 1 or higher. "Mastered" means mastery 3 or higher.
- XP is 10 for a correct answer and 3 for a wrong one, so effort counts.
- Weeks start on Monday, and leaderboards reset then.
- The streak counts consecutive days with at least one attempt, ending today, or ending yesterday if the learner
  hasn't practised yet today.

### Badges

`akwaaba` (first session), `nnanson` (7-day streak), `sankofa` (100 reviews), `nyansapo` (25 words mastered),
`boafo` (one of your answers accepted in the community).

## Lookup and Khaya AI

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/translate/lookup/` | `{text, lang}` → `LookupResult` |
| POST | `/translate/suggestions/` | `{lang, query, suggestion, currentTranslation}` → `{ok: true}`. If someone already suggested the same thing, increment `supporters` instead of adding a duplicate. Limit: 20 suggestions per user per day. |
| GET | `/tts/?text&lang&speaker` | Audio bytes. `lang` is the Khaya TTS code (`twi`, `gaa`). `speaker` is `female`, `male_low` or `male_high`. Cache on disk and send `Cache-Control: public, max-age=2592000`. |

Lookup resolves in this order:

1. A curriculum item whose English matches the query (direction `to_local`), or whose translation matches with
   ɛ/ɔ/ŋ folded to e/o/n (direction `to_english`). Source: `curriculum`.
2. A moderator-approved community translation. Source: `curriculum`.
3. Khaya AI via `POST https://translation-api.ghananlp.org/v1/translate` with body `{"in": text, "lang": "en-tw"}`.
   Use `tw-en`, `en-gaa` or `gaa-en` as needed. Source: `khaya`.
4. Otherwise `result: null`.

`related` holds up to 4 curriculum items that share a word with the query. The Khaya key
(`Ocp-Apim-Subscription-Key`) stays on the server. `backend/khaya.py` has a working client for translation, TTS and
speech recognition.

## Leaderboard

`GET /leaderboard/?scope=school|region|national&lang` → `{scope, label, weekStart, entries (top 20), me}`. Ranks are by
XP this week. Show `displayName`, school and region only.

## Communities

A community is a group with its own discussions: an official Kasa community (Twi help, BECE prep…), a class, a
school, a study group or an interest group. All community endpoints require login.

### Lifecycle and roles

- **Creating.** Anyone can propose a community with `POST /communities/`. Kasa staff (moderators and admins)
  communities are `active` immediately. Everyone else's, teachers included, are `pending` until a moderator reviews
  them. The creator becomes its **owner**. Each user can have at most 3 proposals waiting (429).
- **Statuses.** `pending` and `rejected` communities are visible only to their creator and to Kasa staff; anyone
  else gets 404. A `rejected` community carries a `reviewNote` that is shown to the creator. `archived` communities
  are read-only.
- **Community roles,** from highest: `owner` > `admin` > `helper` > `member`.
  - **Admin** can only be held by adult accounts (teacher, moderator or admin). Trying to make a student an admin
    returns 400.
  - **Helpers** approve and decline join requests, and pin, unpin, lock and unlock discussions.
  - **Admins** can do everything helpers can, plus remove posts and replies, remove members, appoint helpers, edit
    settings and rotate the join code.
  - **Owners** can do everything admins can, plus appoint and remove admins and transfer ownership (to adult members
    only). An owner can't leave without transferring first.
  - **A student owner** (a student who proposed the community) has helper powers, plus editing settings, rotating
    the code and appointing helpers. They can never remove posts or members, and they report problems to Kasa
    instead.
- **Kasa staff** can view every community and act as an admin in all of them.

`CommunityDetail.permissions` tells the client exactly what the viewer may do: `canView`, `canPost`,
`canManageRequests`, `canPin`, `canRemovePosts`, `canManageMembers`, `canAppointAdmins`, `canEditSettings` and
`canLeave`. The UI hides controls based on it, and the server enforces the same rules.

### Visibility and joining

| Join policy | Who can read | How to join |
| --- | --- | --- |
| `open` | Everyone signed in | `POST /communities/{id}/join/` → member at once |
| `request` | Members and staff | `POST /communities/{id}/join/` with an optional `{note}` (≤200, safety-checked) → `pending`. All helpers and above get a `join_request` notification. |
| `code` | Members and staff | `POST /communities/{id}/join/` with `{code}`, or `POST /communities/join-by-code/` with `{code}`. Codes are case- and space-insensitive. |

Discovery cards (name, description and counts) of `request` and `code` communities are visible to everyone; their
discussions and member lists are not. Kasa staff join any community directly. Suspended users can join and read,
but can't post.

### Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/communities/?scope=mine\|discover\|created&q&lang` | `Community[]`. **mine**: the user's memberships plus pending requests. **discover**: active communities the user isn't a member of, open ones first, then by member count, filtered to the user's language and level band (`lang=all` turns the filter off). **created**: everything the user proposed, in any status. |
| POST | `/communities/` | `NewCommunityInput` → `CommunityDetail`. The name must be 4–60 characters and unique (case-insensitive). The description must be 20–400 characters. Up to 6 rules of up to 140 characters each. Everything passes the safety check. The server generates a slug and a readable join code such as `ASF-7B`. |
| GET | `/communities/{idOrSlug}/` | `CommunityDetail`. `joinCode` and `pendingRequests` are only filled in for helpers and above. |
| PATCH | `/communities/{id}/` | `CommunitySettingsPatch` (requires `canEditSettings`). Official communities can only be changed by staff. |
| POST | `/communities/{id}/code/rotate/` | Issues a new join code; the old code stops working. |
| POST | `/communities/{id}/join/` | `{note?, code?}` → `{community, membership}`. Joining again when already a member is a no-op. |
| POST | `/communities/join-by-code/` | `{code}` → `{community, membership}`. Holding the code counts as an invite, so this works whatever the join policy. 404 if no active community has that code. |
| POST | `/communities/{id}/leave/` | Leaves, or cancels a pending request. Returns 400 for the owner. |
| GET | `/communities/{id}/members/?status=member\|pending&q` | `CommunityMember[]`. The member list is visible to members and staff. The pending list is visible to helpers and above, and includes `requestNote`. |
| POST | `/communities/{id}/requests/{userId}/approve/` and `/decline/` | Helpers and above. Notifies the learner (`join_approved` or `join_declined`). |
| PATCH | `/communities/{id}/members/{userId}/` | `{role: admin\|helper\|member}`. Follows the role rules above, and notifies the member (`role_changed`). |
| POST | `/communities/{id}/members/{userId}/remove/` | Adult admins and above only. The owner can't be removed, and only the owner can remove an admin. |
| POST | `/communities/{id}/transfer/` | `{userId}` (must be an adult member) → `CommunityDetail`. The old owner becomes an admin if they're an adult, or a helper if they're a student. |

## Discussions

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/community/threads/?communityId&sort=active\|new\|top\|unanswered&q&lang&cursor` | `{items, nextCursor}`, 15 per page. With `communityId`: that community's discussions, pinned first (403 if the viewer can't view it). Without it: a feed from every community the user is a member of. Removed threads are hidden. |
| POST | `/community/threads/` | `{communityId, title (8–120), body (10–4000), tags[]}` → `ThreadDetail`. Requires `canPost`, which means a member of an active community. In `staffOnlyPosting` communities (announcements), only admins and above can post. |
| GET | `/community/threads/{id}/` | `ThreadDetail` with `canAccept`, `canModerate` (pin and lock) and `canRemove`. Returns 403 if the viewer can't view the community, and 404 for removed threads unless the viewer can remove posts. |
| POST | `/community/threads/{id}/replies/` | `{body (2–2000)}` → `Reply`. Members only. Locked threads only accept replies from helpers and above. Notifies the thread's author (`reply`). |
| POST | `/community/threads/{id}/vote/`, `/community/replies/{id}/vote/` | `{value: -1\|0\|1}` → `{score, myVote}`. Members only, and not on your own post. |
| POST | `/community/replies/{id}/accept/` | Toggles the accepted answer. Allowed for the thread's author, teachers, community admins and Kasa staff. Awards `boafo` and notifies the reply's author (`answer_accepted`). |
| POST | `/community/threads/{id}/pin/`, `/lock/` | Helpers and above. Toggles. |
| POST | `/community/threads/{id}/remove/`, `/community/replies/{id}/remove/` | Community admins (adults) and Kasa staff. Removed replies stay in the list with `status: "removed"` and an empty body. |
| POST | `/community/reports/` | `{targetType, targetId, reason, note}` → `{ok: true}`. Goes to the Kasa moderation queue. A repeat report from the same user is ignored, and you can't report your own post. |

### Child safety (required)

Most users are minors.

- **No private contact.** There are no direct messages and no public profile pages. Authors show only
  `displayName`, a platform role chip and their class.
- **Blocked content.** Reject posts, replies, join-request notes, and community names, descriptions and rules that
  contain phone numbers (Ghana formats such as `024 123 4567` and `+233 24 123 4567`), email addresses, links or
  insults. Reply with a 400 that explains why. The shared rules are in `frontend/src/shared/lib/safety.ts`.
- **Rate limits.** At most 5 new threads and 30 replies per user per day, and 3 community proposals waiting for
  review (429).
- **Kasa oversight.** Moderators can see every community, including private ones, and every new community is
  reviewed before it goes live.

## Community admin

All of these require the moderator or admin role.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/overview/` | `AdminOverview`, including `pendingCommunities` and `activeCommunities` |
| GET | `/admin/communities/?status=pending\|active\|rejected\|archived&page` | Paginated `Community`. Pending is oldest first; the other statuses are newest first. |
| POST | `/admin/communities/{id}/review/` | `{decision: approve\|reject, note}` → `Community`. A rejection needs a note (5–300 characters), which is shown to the creator. Either decision notifies the creator (`community_approved` or `community_rejected`). Returns 400 if the community was already reviewed. |
| POST | `/admin/communities/{id}/archive/` | Active communities only. Archiving an official community needs the admin role. |
| GET | `/admin/reports/?status=open\|resolved\|dismissed&page` | Paginated `Report`. One row per reported item, with `reportCount`. |
| POST | `/admin/reports/{id}/resolve/` | `{action: dismiss\|remove_content\|warn_user\|suspend_user, note}` → `Report`. Resolves every open report on the same item. Staff can't be suspended. |
| GET | `/admin/suggestions/?status=pending\|approved\|rejected&page` | Paginated `Suggestion` |
| POST | `/admin/suggestions/{id}/review/` | `{decision: approve\|reject, finalTranslation?}` → `Suggestion`. Approving makes the translation teacher-verified in Lookup. |
| GET | `/admin/users/?q&role&status&page` | Paginated `AdminUser` |
| PATCH | `/admin/users/{id}/` | `{role?, status?}` → `AdminUser`. Only admins can change platform roles. Moderators can suspend students. Nobody can change their own account or an admin's account. |

Log every moderation action (who, what, when, why) in an audit table, including community reviews, role changes and
removals, even though the UI doesn't show it yet.
