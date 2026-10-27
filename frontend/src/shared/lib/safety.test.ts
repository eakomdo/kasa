import { describe, expect, it } from 'vitest';
import { CONTACT_MESSAGE, INSULT_MESSAGE, checkPostSafety } from './safety';

describe('checkPostSafety', () => {
  it.each([
    'Call me on 024 123 4567',
    'my number is 0241234567',
    'WhatsApp +233 24 123 4567',
    'text 233-55-123-4567 please',
    'try 020.555.0199',
  ])('blocks Ghanaian phone numbers: %s', (text) => {
    expect(checkPostSafety(text)).toBe(CONTACT_MESSAGE);
  });

  it.each([
    'email me at ama@example.com',
    'see https://example.com',
    'go to www.cheapdata.gh',
    'visit cheapdata.com now',
    'follow me @ama_learns',
  ])('blocks contact details and links: %s', (text) => {
    expect(checkPostSafety(text)).toBe(CONTACT_MESSAGE);
  });

  it.each(['you are so stupid', 'What an IDIOT', 'shut   up', 'kwasia'])('blocks insults: %s', (text) => {
    expect(checkPostSafety(text)).toBe(INSULT_MESSAGE);
  });

  it.each([
    'When do I say “Yaa ɛna”?',
    'Mmienu is for things, baanu is for people.',
    'I am twelve years old and in JHS 1.',
    'My streak is 14 days and I reviewed 120 cards!',
    'e.g. Medaase means thank you.',
    'The fooled-around word list was fun', // "fool" only matches as a whole word
  ])('allows normal learning posts: %s', (text) => {
    expect(checkPostSafety(text)).toBeNull();
  });
});
