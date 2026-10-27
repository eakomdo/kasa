/**
 * Child-safety check for community posts. Most Kasa learners are minors, so
 * posts may not carry contact details, links or insults. The same check runs
 * in the browser (instant feedback) and on the server (the real gate).
 */

/** Ghana numbers: 024 123 4567, 0241234567, +233 24 123 4567, 233-24-123-4567 */
const GH_PHONE = /(?:\+?233|\b0)[\s.-]?[2-5]\d(?:[\s.-]?\d){7}\b/;
/** Any other long run of digits that looks like a phone number */
const LONG_NUMBER = /\d(?:[\s.-]?\d){8,}/;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|gh|io|me|ly|co|app|xyz|info)\b/i;
/** Handles commonly used to move a chat off-platform */
const SOCIAL_HANDLE = /(?:^|\s)@[a-z0-9_.]{3,}/i;

/** Kept short on purpose; moderators handle what a word list can't. */
const INSULTS = ['stupid', 'idiot', 'fool', 'foolish', 'dumb', 'useless', 'shut up', 'kwasia', 'ashawo'];
const INSULT = new RegExp(`\\b(?:${INSULTS.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})\\b`, 'i');

export const CONTACT_MESSAGE =
  "For your safety, don't share phone numbers, emails, social media or links in the community.";
export const INSULT_MESSAGE = "Let's keep Kasa kind. Please remove the insult before posting.";

export function checkPostSafety(text: string): string | null {
  const t = text.normalize('NFC');
  if (GH_PHONE.test(t) || LONG_NUMBER.test(t) || EMAIL.test(t) || URL.test(t) || SOCIAL_HANDLE.test(t))
    return CONTACT_MESSAGE;
  if (INSULT.test(t)) return INSULT_MESSAGE;
  return null;
}
