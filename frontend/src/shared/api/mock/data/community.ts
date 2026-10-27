/**
 * Seed content for the community forum and moderation queues.
 * Twi and Ga text here is limited to words already in curriculum.ts (or named
 * in the product brief) so nothing unreviewed reaches learners.
 */
import { addDays } from '@/shared/lib/date';
import type {
  Db,
  DbCommunity,
  DbMembership,
  DbNotification,
  DbReply,
  DbReport,
  DbSuggestion,
  DbThread,
} from '../db';

type CommunitySeed = Omit<DbCommunity, 'createdAt' | 'reviewNote' | 'reviewedById' | 'slug'> & {
  daysAgo: number;
  reviewNote?: string;
};

const official = (
  id: string,
  name: string,
  description: string,
  lang: 'twi' | 'ga' | null,
  color: DbCommunity['color'],
  joinCode: string,
  extra: Partial<CommunitySeed> = {},
): CommunitySeed => ({
  id,
  name,
  description,
  kind: 'official',
  official: true,
  lang,
  bands: [],
  joinPolicy: 'open',
  joinCode,
  status: 'active',
  color,
  school: null,
  region: null,
  rules: [
    'Be kind and patient. Everyone here is still learning.',
    'Explain your answers so others learn too.',
    'Never share phone numbers, emails or social media, and never arrange to meet.',
  ],
  staffOnlyPosting: false,
  createdById: 'u-efua',
  daysAgo: 120,
  ...extra,
});

/** Official Kasa communities plus a few learner-run ones, in every review state. */
const COMMUNITIES: CommunitySeed[] = [
  official(
    'announcements',
    'Kasa announcements',
    'News from the Kasa team: new units, features and community updates.',
    null,
    'forest',
    'KSA-1A',
    { staffOnlyPosting: true },
  ),
  official(
    'twi-help',
    'Twi help',
    'Stuck on a Twi word, phrase or spelling? Ask here.',
    'twi',
    'gold',
    'TWI-2B',
  ),
  official('ga-help', 'Ga help', 'Questions about Ga words, greetings and spelling.', 'ga', 'sky', 'GAA-3C'),
  official(
    'bece-prep',
    'BECE and WASSCE prep',
    'Revision tips and practice ideas for your Ghanaian language exams.',
    null,
    'clay',
    'BCE-4D',
  ),
  official(
    'culture',
    'Proverbs, stories and culture',
    'Share proverbs, festivals and the stories behind the words.',
    null,
    'gold',
    'PRV-5E',
  ),
  official(
    'pronunciation',
    'Pronunciation',
    'How do you say it? Help with sounds, tones and special letters.',
    null,
    'sky',
    'PRN-6F',
  ),
  {
    id: 'asafo-jhs1b',
    name: 'Asafo JHS 1B Twi',
    description:
      'Our class space for Twi with Mr Boateng. Homework reminders, questions about lessons and practice together.',
    kind: 'class',
    official: false,
    lang: 'twi',
    bands: ['jhs'],
    joinPolicy: 'code',
    joinCode: 'ASF-7B',
    status: 'active',
    color: 'forest',
    school: 'Asafo M/A JHS',
    region: 'Ashanti',
    rules: [
      'Be kind and patient. Everyone here is still learning.',
      'Explain your answers so others learn too.',
      'Never share phone numbers or meet up.',
      'Use your real first name so Mr Boateng knows who you are.',
    ],
    staffOnlyPosting: false,
    createdById: 'u-kojo',
    daysAgo: 30,
  },
  {
    id: 'kumasi-bece',
    name: 'Kumasi BECE study group',
    description:
      'JHS 3 students in Kumasi revising Twi for the BECE together. We set a weekly goal and check in every Friday.',
    kind: 'study',
    official: false,
    lang: 'twi',
    bands: ['jhs'],
    joinPolicy: 'request',
    joinCode: 'KMS-8C',
    status: 'active',
    color: 'clay',
    school: null,
    region: 'Ashanti',
    rules: [
      'Be kind and patient.',
      'Post your weekly progress every Friday.',
      'Never share phone numbers or meet up.',
    ],
    staffOnlyPosting: false,
    createdById: 'u-kwame',
    daysAgo: 12,
  },
  {
    id: 'accra-ga',
    name: 'Accra Ga learners',
    description:
      'For anyone learning Ga in and around Accra. Share words you hear at home, at school and at the market.',
    kind: 'interest',
    official: false,
    lang: 'ga',
    bands: [],
    joinPolicy: 'open',
    joinCode: 'ACR-9D',
    status: 'active',
    color: 'sky',
    school: null,
    region: 'Greater Accra',
    rules: ['Be kind and patient.', 'Explain your answers.', 'Never share phone numbers or meet up.'],
    staffOnlyPosting: false,
    createdById: 'u-naa',
    daysAgo: 25,
  },
  {
    id: 'sunyani-readers',
    name: 'Sunyani Twi readers',
    description:
      'SHS students in Bono who want to read Twi stories and proverbs together and talk about what they mean.',
    kind: 'interest',
    official: false,
    lang: 'twi',
    bands: ['shs'],
    joinPolicy: 'request',
    joinCode: 'SNY-2E',
    status: 'pending',
    color: 'gold',
    school: 'Sunyani Hilltop SHS',
    region: 'Bono',
    rules: ['Be kind and patient.', 'Explain your answers.', 'Never share phone numbers or meet up.'],
    staffOnlyPosting: false,
    createdById: 'u-akosua',
    daysAgo: 1,
  },
  {
    id: 'cheap-data',
    name: 'Cheap data deals',
    description: 'Best data bundle prices for students. Message me for deals every week.',
    kind: 'interest',
    official: false,
    lang: null,
    bands: [],
    joinPolicy: 'open',
    joinCode: 'CHP-3F',
    status: 'rejected',
    color: 'clay',
    school: null,
    region: 'Western',
    rules: [],
    staffOnlyPosting: false,
    createdById: 'u-kwesi',
    daysAgo: 3,
    reviewNote: 'Communities on Kasa are for learning Twi and Ga together. Selling things isn’t allowed.',
  },
];

const OFFICIAL_IDS = ['announcements', 'twi-help', 'ga-help', 'bece-prep', 'culture', 'pronunciation'];

type ThreadSeed = Omit<DbThread, 'createdAt' | 'lastActivityAt' | 'status' | 'acceptedReplyId'> & {
  daysAgo: number;
  replies: Array<{
    id: string;
    authorId: string;
    body: string;
    hoursLater: number;
    baseScore: number;
    accepted?: boolean;
  }>;
};

const THREADS: ThreadSeed[] = [
  {
    id: 't-welcome',
    communityId: 'announcements',
    title: 'Akwaaba to the Kasa community',
    body: [
      'Akwaaba! This is a place to ask questions, help each other and share what you are learning in Twi and Ga.',
      'A few rules keep it safe for everyone:',
      '1. Be kind. Everyone here is still learning.',
      '2. Explain your answers. Help people understand, don’t just hand over homework answers.',
      '3. Never share your phone number, email, address or social media, and never arrange to meet anyone.',
      '4. If something feels wrong, tap Report. Moderators check reports every day.',
      'Teachers have a green Teacher badge. Their answers are checked against the GES curriculum.',
      'Medaase, and enjoy learning!',
    ].join('\n\n'),
    authorId: 'u-efua',
    lang: null,
    tags: [],
    pinned: true,
    locked: true,
    baseScore: 48,
    daysAgo: 14,
    replies: [],
  },
  {
    id: 't-yaa-ena',
    communityId: 'twi-help',
    title: 'When do I say “Yaa ɛna” or “Yaa agya”?',
    body: 'My grandmother greeted me “Maakye” this morning and I didn’t know how to answer. I know there is a special reply but I mix them up. When do I use each one?',
    authorId: 'u-yaa',
    lang: 'twi',
    tags: ['twi', 'grammar'],
    pinned: false,
    locked: false,
    baseScore: 21,
    daysAgo: 9,
    replies: [
      {
        id: 'r-yaa-ena-1',
        authorId: 'u-kojo',
        body: 'Good question! The reply depends on who greets you:\n\n• “Yaa ɛna” to an older woman, like your grandmother or a female teacher.\n• “Yaa agya” to an older man.\n• “Yaa nua” to someone about your own age.\n\nSo for your grandmother: “Yaa ɛna”. She will be very happy you answered properly.',
        hoursLater: 2,
        baseScore: 34,
        accepted: true,
      },
      {
        id: 'r-yaa-ena-2',
        authorId: 'u-kwame',
        body: 'I used to mix them up too. I remember it because ɛna sounds like “mother”, so it is for women.',
        hoursLater: 5,
        baseScore: 12,
      },
    ],
  },
  {
    id: 't-mmienu',
    communityId: 'twi-help',
    title: 'Mmienu or baanu? Which one means two?',
    body: 'In the numbers unit “two” is “Mmienu”, but in the family unit it says “Mewɔ anuanom baanu” for “I have two siblings”. Are they the same word?',
    authorId: 'u-kofi',
    lang: 'twi',
    tags: ['twi', 'vocabulary', 'grammar'],
    pinned: false,
    locked: false,
    baseScore: 17,
    daysAgo: 7,
    replies: [
      {
        id: 'r-mmienu-1',
        authorId: 'u-kojo',
        body: 'Both mean two, but Twi counts people and things differently:\n\n• “Mmienu” is for things: two books, two oranges.\n• “Baanu” is for people: two siblings, two teachers.\n\nThat is why the family phrase uses baanu. This often comes up in exams, so it is worth learning well.',
        hoursLater: 3,
        baseScore: 26,
        accepted: true,
      },
    ],
  },
  {
    id: 't-proverbs',
    communityId: 'culture',
    title: 'Share your favourite Twi proverb',
    body: 'We are learning proverbs in SHS 1. Which one is your favourite and what does it mean to you? Mine is “Nyansa nni onipa baako ti mu” (wisdom is not in one person’s head). It reminds me to ask for help.',
    authorId: 'u-akosua',
    lang: 'twi',
    tags: ['proverbs', 'twi'],
    pinned: false,
    locked: false,
    baseScore: 19,
    daysAgo: 6,
    replies: [
      {
        id: 'r-proverbs-1',
        authorId: 'u-ama',
        body: '“Dua koro gye mframa a, ɛbu.” A tree that faces the wind alone will break. My friends and I revise together because of this one.',
        hoursLater: 4,
        baseScore: 11,
      },
      {
        id: 'r-proverbs-2',
        authorId: 'u-kwame',
        body: '“Sɛ wo werɛ fi na wosan kɔ fa a, yennkyiri.” It is not wrong to go back for what you forgot. That is Sankofa! It is why I review old units.',
        hoursLater: 9,
        baseScore: 14,
      },
      {
        id: 'r-proverbs-3',
        authorId: 'u-kojo',
        body: 'Lovely choices. For the WASSCE, remember to explain the meaning and when you would use a proverb, not only write it out.',
        hoursLater: 20,
        baseScore: 9,
      },
    ],
  },
  {
    id: 't-ga-thanks',
    communityId: 'ga-help',
    title: 'How do you say “thank you” in Ga?',
    body: 'I just started the Ga course. What is the word for thank you? I want to thank my auntie in Accra.',
    authorId: 'u-esi',
    lang: 'ga',
    tags: ['ga', 'vocabulary'],
    pinned: false,
    locked: false,
    baseScore: 8,
    daysAgo: 5,
    replies: [
      {
        id: 'r-ga-thanks-1',
        authorId: 'u-naa',
        body: '“Oyiwaladɔŋŋ” means thank you. The ŋ is said like the “ng” in sing. Your auntie will love it!',
        hoursLater: 1,
        baseScore: 13,
        accepted: true,
      },
      {
        id: 'r-ga-thanks-2',
        authorId: 'u-nii',
        body: 'And if she says something nice back, you can answer “Ojekoo” (well done) when she cooks for you 😄',
        hoursLater: 6,
        baseScore: 5,
      },
    ],
  },
  {
    id: 't-pronounce',
    communityId: 'pronunciation',
    title: 'How do I pronounce ɛ and ɔ?',
    body: 'I can read them but I’m not sure my sounds are right. Any tips for ɛ and ɔ?',
    authorId: 'u-adjoa',
    lang: null,
    tags: ['pronunciation'],
    pinned: false,
    locked: false,
    baseScore: 10,
    daysAgo: 4,
    replies: [
      {
        id: 'r-pronounce-1',
        authorId: 'u-yaw',
        body: 'A simple way to start:\n\n• ɛ sounds like the “e” in bed. Try “Medaase”.\n• ɔ sounds like the “o” in pot. Try “Ɔkyena” (tomorrow).\n\nPlay the audio on the word cards and copy it out loud a few times.',
        hoursLater: 3,
        baseScore: 7,
      },
    ],
  },
  {
    id: 't-bece-revise',
    communityId: 'bece-prep',
    title: 'How do you revise vocabulary for the BECE?',
    body: 'BECE is coming and I keep forgetting words I learned last term. How do you all revise?',
    authorId: 'u-kwame',
    lang: null,
    tags: ['bece', 'vocabulary'],
    pinned: false,
    locked: false,
    baseScore: 15,
    daysAgo: 3,
    replies: [
      {
        id: 'r-bece-1',
        authorId: 'u-kojo',
        body: 'Some tips that work for my JHS 3 class:\n\n1. Little and often. 10 cards every day beats 100 cards on Sunday.\n2. Don’t skip review cards. Kasa brings words back just before you forget them.\n3. Say each word out loud, then write it with the correct letters (ɛ, ɔ).\n4. Use the multiple choice mode in the last weeks, because it is closest to the exam.',
        hoursLater: 2,
        baseScore: 22,
      },
      {
        id: 'r-bece-2',
        authorId: 'u-ama',
        body: 'I set a WhatsApp reminder for 6pm in settings. It really helps me keep my streak.',
        hoursLater: 8,
        baseScore: 6,
      },
    ],
  },
  {
    id: 't-challenge',
    communityId: 'bece-prep',
    title: 'Daily 10-card challenge, who’s in?',
    body: 'Let’s all do at least 10 cards a day this week and post here when we finish. Day 1 done ✅',
    authorId: 'u-ama',
    lang: null,
    tags: ['vocabulary'],
    pinned: false,
    locked: false,
    baseScore: 12,
    daysAgo: 2,
    replies: [
      { id: 'r-challenge-1', authorId: 'u-yaa', body: 'I’m in! Day 1 done.', hoursLater: 1, baseScore: 4 },
      {
        id: 'r-challenge-2',
        authorId: 'u-kofi',
        body: 'Done for today. 4 day streak now.',
        hoursLater: 6,
        baseScore: 3,
      },
      {
        id: 'r-challenge-3',
        authorId: 'u-kwesi',
        body: 'CHEAP DATA BUNDLES 10GB for GH₵5!!! WhatsApp me on 024 555 0199 now',
        hoursLater: 10,
        baseScore: -6,
      },
      {
        id: 'r-challenge-4',
        authorId: 'u-fiifi',
        body: 'your Twi is so bad lol',
        hoursLater: 12,
        baseScore: -3,
      },
    ],
  },
  {
    id: 't-computer',
    communityId: 'twi-help',
    title: 'What is the Twi word for computer?',
    body: 'Our ICT teacher asked us and nobody in class knew. Is there a Twi word, or do we just say computer?',
    authorId: 'u-yaa',
    lang: 'twi',
    tags: ['twi', 'vocabulary'],
    pinned: false,
    locked: false,
    baseScore: 3,
    daysAgo: 0.3,
    replies: [],
  },
  {
    id: 't-asafo-homework',
    communityId: 'asafo-jhs1b',
    title: 'Homework: practise the greetings unit before Friday',
    body: 'Akwaaba to our class space! Before Friday, please finish two practice sessions on the Nkyia (greetings) unit. On Friday we will greet each other in Twi at the start of the lesson.\n\nIf you are stuck, ask here. Kwame is our class helper and can approve new classmates.',
    authorId: 'u-kojo',
    lang: 'twi',
    tags: ['twi', 'vocabulary'],
    pinned: true,
    locked: false,
    baseScore: 6,
    daysAgo: 5,
    replies: [
      {
        id: 'r-asafo-hw-1',
        authorId: 'u-yaa',
        body: 'Done! Medaase, Mr Boateng.',
        hoursLater: 20,
        baseScore: 2,
      },
    ],
  },
  {
    id: 't-asafo-reply',
    communityId: 'asafo-jhs1b',
    title: 'How do I reply when Mr Boateng greets us in the morning?',
    body: 'When Mr Boateng says “Maakye” to the class, what should we say back?',
    authorId: 'u-ama',
    lang: 'twi',
    tags: ['twi', 'grammar'],
    pinned: false,
    locked: false,
    baseScore: 3,
    daysAgo: 1,
    replies: [
      {
        id: 'r-asafo-reply-1',
        authorId: 'u-kwame',
        body: 'Say “Yaa agya”, because he is older than us. Mr Boateng explained it in Twi help too: “Yaa ɛna” is for an older woman.',
        hoursLater: 3,
        baseScore: 4,
      },
    ],
  },
  {
    id: 't-kumasi-week',
    communityId: 'kumasi-bece',
    title: 'This week: finish the market unit (Gua so)',
    body: 'Our goal this week is the Gua so unit. Post here on Friday with how many cards you did. I’m starting with “Ɛyɛ sɛn?” and “Te so ma me.”',
    authorId: 'u-kwame',
    lang: 'twi',
    tags: ['bece', 'vocabulary'],
    pinned: true,
    locked: false,
    baseScore: 5,
    daysAgo: 4,
    replies: [],
  },
  {
    id: 't-accra-welcome',
    communityId: 'accra-ga',
    title: 'Welcome! Start with the Ga greetings unit',
    body: 'Welcome to Accra Ga learners. A good first step is the greetings unit. Try “Oyiwaladɔŋŋ” (thank you) at home this week and tell us how it went. Ojekoo!',
    authorId: 'u-naa',
    lang: 'ga',
    tags: ['ga'],
    pinned: true,
    locked: false,
    baseScore: 7,
    daysAgo: 20,
    replies: [],
  },
];

const hours = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);

export function seedCommunity(
  now: Date,
): Pick<
  Db,
  | 'communities'
  | 'memberships'
  | 'notifications'
  | 'threads'
  | 'replies'
  | 'votes'
  | 'reports'
  | 'suggestions'
> {
  const communities: DbCommunity[] = COMMUNITIES.map(({ daysAgo, reviewNote, ...c }) => ({
    ...c,
    slug: c.id,
    createdAt: addDays(now, -daysAgo).toISOString(),
    reviewNote: reviewNote ?? null,
    reviewedById: c.status === 'rejected' || (c.status === 'active' && !c.official) ? 'u-yaw' : null,
  }));
  const memberships = seedMemberships(now);
  const notifications = seedNotifications(now);

  const threads: DbThread[] = [];
  const replies: DbReply[] = [];

  for (const t of THREADS) {
    const created = addDays(now, -t.daysAgo);
    let last = created;
    let accepted: string | null = null;
    for (const r of t.replies) {
      const at = hours(created, r.hoursLater);
      if (at > last) last = at;
      if (r.accepted) accepted = r.id;
      replies.push({
        id: r.id,
        threadId: t.id,
        authorId: r.authorId,
        body: r.body,
        createdAt: at.toISOString(),
        status: 'visible',
        baseScore: r.baseScore,
      });
    }
    const { daysAgo: _d, replies: _r, ...rest } = t;
    threads.push({
      ...rest,
      createdAt: created.toISOString(),
      lastActivityAt: last.toISOString(),
      status: 'visible',
      acceptedReplyId: accepted,
    });
  }

  const reports: DbReport[] = [
    {
      id: 'rep-spam',
      targetType: 'reply',
      targetId: 'r-challenge-3',
      reason: 'spam',
      note: 'Advert with a phone number.',
      reporterId: 'u-yaa',
      createdAt: hours(addDays(now, -2), 11).toISOString(),
      status: 'open',
      resolution: null,
      action: null,
    },
    {
      id: 'rep-rude-1',
      targetType: 'reply',
      targetId: 'r-challenge-4',
      reason: 'bullying',
      note: '',
      reporterId: 'u-ama',
      createdAt: hours(addDays(now, -2), 13).toISOString(),
      status: 'open',
      resolution: null,
      action: null,
    },
    {
      id: 'rep-rude-2',
      targetType: 'reply',
      targetId: 'r-challenge-4',
      reason: 'bullying',
      note: 'This is unkind to Ama.',
      reporterId: 'u-kofi',
      createdAt: hours(addDays(now, -2), 15).toISOString(),
      status: 'open',
      resolution: null,
      action: null,
    },
    {
      id: 'rep-translation',
      targetType: 'reply',
      targetId: 'r-pronounce-1',
      reason: 'wrong_translation',
      note: 'The example word list looks muddled. “Medaase” has no ɛ in it.',
      reporterId: 'u-akosua',
      createdAt: hours(addDays(now, -4), 6).toISOString(),
      status: 'open',
      resolution: null,
      action: null,
    },
    {
      id: 'rep-old',
      targetType: 'thread',
      targetId: 't-challenge',
      reason: 'other',
      note: 'Is it allowed to make challenges?',
      reporterId: 'u-esi',
      createdAt: hours(addDays(now, -2), 2).toISOString(),
      status: 'dismissed',
      resolution: 'Dismissed by Yaw D.: friendly study challenges are welcome.',
      action: 'dismiss',
    },
  ];

  const suggestion = (
    id: string,
    lang: 'twi' | 'ga',
    query: string,
    current: string | null,
    text: string,
    by: string,
    supporters: number,
    daysAgo: number,
    status: DbSuggestion['status'] = 'pending',
  ): DbSuggestion => ({
    id,
    lang,
    query,
    currentTranslation: current,
    suggestion: text,
    submittedById: by,
    supporters,
    createdAt: addDays(now, -daysAgo).toISOString(),
    status,
  });

  const suggestions: DbSuggestion[] = [
    suggestion(
      's-goodnight',
      'twi',
      'good night',
      'Da yie',
      'Da yie (to one person), Mo nna yie (to a group)',
      'u-akosua',
      4,
      1,
    ),
    suggestion('s-friend', 'twi', 'friend', 'Adamfo', 'Adamfo or Ɔyɔnko', 'u-kwame', 2, 2),
    suggestion('s-computer', 'twi', 'computer', null, 'Kɔmputa', 'u-yaa', 6, 0.2),
    suggestion('s-ga-friend', 'ga', 'friend', 'Naanyo', 'Naanyo (one friend)', 'u-nii', 1, 3),
    suggestion('s-family', 'twi', 'family', 'Abusua', 'Abusua', 'u-kofi', 3, 9, 'approved'),
    suggestion('s-water', 'twi', 'water', 'Nsuo', 'idk lol', 'u-kwesi', 0, 6, 'rejected'),
  ];

  return { communities, memberships, notifications, threads, replies, votes: {}, reports, suggestions };
}

/* ---------- Memberships ---------- */
const LANG_OF: Record<string, 'twi' | 'ga'> = {
  'u-ama': 'twi',
  'u-kojo': 'twi',
  'u-naa': 'ga',
  'u-yaw': 'twi',
  'u-efua': 'twi',
  'u-kwame': 'twi',
  'u-yaa': 'twi',
  'u-kofi': 'twi',
  'u-akosua': 'twi',
  'u-esi': 'twi',
  'u-nii': 'ga',
  'u-adjoa': 'ga',
  'u-kwesi': 'twi',
  'u-fiifi': 'twi',
};

function seedMemberships(now: Date): DbMembership[] {
  const out: DbMembership[] = [];
  const add = (communityId: string, userId: string, role: DbMembership['role'] = 'member', daysAgo = 10) => {
    if (out.some((m) => m.communityId === communityId && m.userId === userId)) return;
    out.push({
      communityId,
      userId,
      role,
      status: 'member',
      joinedAt: addDays(now, -daysAgo).toISOString(),
      requestedAt: null,
      requestNote: null,
    });
  };
  // Kasa team runs every official community
  for (const id of OFFICIAL_IDS) {
    add(id, 'u-efua', 'owner', 120);
    add(id, 'u-yaw', 'admin', 110);
  }
  add('twi-help', 'u-kojo', 'admin', 90);
  add('ga-help', 'u-naa', 'admin', 80);
  // Everyone gets announcements and the help community for their language
  for (const [userId, lang] of Object.entries(LANG_OF)) {
    add('announcements', userId);
    add(lang === 'twi' ? 'twi-help' : 'ga-help', userId);
  }
  for (const u of ['u-ama', 'u-kwame', 'u-yaa', 'u-kofi', 'u-fiifi', 'u-kwesi']) add('bece-prep', u);
  for (const u of ['u-akosua', 'u-kwame', 'u-kojo']) add('culture', u);
  for (const u of ['u-adjoa', 'u-yaw']) add('pronunciation', u);
  add('pronunciation', 'u-adjoa');
  // Learner-run communities
  add('asafo-jhs1b', 'u-kojo', 'owner', 30);
  add('asafo-jhs1b', 'u-kwame', 'helper', 29);
  add('asafo-jhs1b', 'u-ama', 'member', 28);
  add('asafo-jhs1b', 'u-yaa', 'member', 28);
  add('kumasi-bece', 'u-kwame', 'owner', 12);
  add('kumasi-bece', 'u-yaa', 'member', 10);
  add('accra-ga', 'u-naa', 'owner', 25);
  add('accra-ga', 'u-nii', 'member', 20);
  add('accra-ga', 'u-adjoa', 'member', 4);
  add('sunyani-readers', 'u-akosua', 'owner', 1);
  add('cheap-data', 'u-kwesi', 'owner', 3);
  out.push({
    communityId: 'kumasi-bece',
    userId: 'u-kofi',
    role: null,
    status: 'pending',
    joinedAt: null,
    requestedAt: addDays(now, -0.5).toISOString(),
    requestNote: 'I’m in JHS 3 at Bantama and want to revise for the BECE with you.',
  });
  return out;
}

/* ---------- Notifications ---------- */
function seedNotifications(now: Date): DbNotification[] {
  return [
    {
      id: 'n-seed-reply',
      userId: 'u-ama',
      kind: 'reply',
      title: 'Kwame O. replied to your question',
      body: '“How do I reply when Mr Boateng greets us in the morning?” in Asafo JHS 1B Twi',
      href: '/community/t/t-asafo-reply',
      createdAt: addDays(now, -0.85).toISOString(),
      read: false,
    },
    {
      id: 'n-seed-badge',
      userId: 'u-ama',
      kind: 'badge',
      title: 'You earned the Akwaaba badge',
      body: 'You finished your first practice session. Ayekoo!',
      href: '/profile',
      createdAt: addDays(now, -6).toISOString(),
      read: true,
    },
    {
      id: 'n-seed-request',
      userId: 'u-kwame',
      kind: 'join_request',
      title: 'Kofi A. asked to join Kumasi BECE study group',
      body: 'Approve or decline the request.',
      href: '/community/c/kumasi-bece/manage',
      createdAt: addDays(now, -0.5).toISOString(),
      read: false,
    },
    {
      id: 'n-seed-rejected',
      userId: 'u-kwesi',
      kind: 'community_rejected',
      title: 'Cheap data deals wasn’t approved',
      body: 'Communities on Kasa are for learning Twi and Ga together. Selling things isn’t allowed.',
      href: '/community/c/cheap-data',
      createdAt: addDays(now, -2).toISOString(),
      read: false,
    },
  ];
}
