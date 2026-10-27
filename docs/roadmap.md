# Roadmap

## Built (frontend v0.1)

- All learner screens: onboarding, home, units, practice (3 modes), lookup, profile, leaderboard, settings
- Community forum and community admin dashboard
- Offline-first PWA, an offline answer outbox, and a data saver
- A typed API contract, plus a mock backend that enforces the contract's rules
- 76 unit, component and contract tests, 8 end-to-end tests (phone and desktop), and CI

## Before launch

1. **Content sign-off.** Native-speaking teachers review every Twi and Ga entry. Ga is marked "in review"
   throughout the app until then.
2. **Backend.** Build Django + DRF to [`api-contract.md`](api-contract.md). Port the mock contract tests as
   acceptance tests.
3. **Native-speaker recordings** for every word. Khaya AI text-to-speech is the fallback.
4. **Policies.** A privacy policy and terms that follow Ghana's Data Protection Act, 2012 (Act 843), with parental
   consent for primary pupils.
5. **Branding.** A designer replaces the placeholder badge emblems with proper Adinkra-inspired artwork.

## Next

| Idea | Why it matters in Ghana |
| --- | --- |
| Speaking practice using Khaya speech recognition | The oral part of the language syllabus, which flashcards can't teach |
| Graded readers (short Anansesɛm stories with tap-to-translate) | Covers the reading and literature strands |
| BECE and WASSCE mock papers | Uses the question formats students will meet in the exams |
| Teacher dashboard and class codes | Lets schools adopt Kasa as a class tool |
| SMS and WhatsApp streak reminders | Reach learners without data |
| Weekly progress email to parents and guardians | Keeps families involved |
| More languages: Ewe, Fante, Dagbani, Gurune | Khaya already supports them |
| Mobile Money billing (Kasa Plus) | Uses the payment method families already have |
| Anonymous, aggregated learning data for GES | Shows which words and units students struggle with, by region |
