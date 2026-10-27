/**
 * The Kasa API contract. Every response is validated against these schemas,
 * so a backend change that breaks the contract fails loudly in development
 * instead of rendering garbage. docs/api-contract.md mirrors this file.
 *
 * JSON is camelCase (Django: djangorestframework-camel-case). Dates are ISO 8601.
 */
import { z } from 'zod';

const isoDate = z.string(); // "2026-10-26T14:03:00Z"
const day = z.string(); // "2026-10-26"
const lang = z.enum(['twi', 'ga']);
const levelId = z.enum(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'shs1', 'shs2', 'shs3']);
const band = z.enum(['lp', 'up', 'jhs', 'shs']);

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

/* ---------- Users and auth ---------- */
export const roleSchema = z.enum(['student', 'teacher', 'moderator', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(), // "Ama M." — the only name other students see
  email: z.string(),
  role: roleSchema,
  status: z.enum(['active', 'suspended']),
  onboarded: z.boolean(),
  lang,
  levelId,
  dailyGoal: z.number().int(),
  voice: z.enum(['female', 'male_low', 'male_high']),
  school: z.string().nullable(),
  region: z.string().nullable(),
  guardianEmail: z.string().nullable(),
  plan: z.enum(['free', 'plus']),
  reminder: z.object({
    enabled: z.boolean(),
    channel: z.enum(['whatsapp', 'sms', 'push']),
    time: z.string(), // "18:00", Africa/Accra
  }),
  createdAt: isoDate,
});
export type User = z.infer<typeof userSchema>;
export type UserPatch = Partial<
  Pick<
    User,
    | 'name'
    | 'lang'
    | 'levelId'
    | 'dailyGoal'
    | 'voice'
    | 'school'
    | 'region'
    | 'guardianEmail'
    | 'reminder'
    | 'onboarded'
  >
>;

export const authResponseSchema = z.object({ token: z.string(), user: userSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

export interface LoginInput {
  email: string;
  password: string;
}
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/* ---------- Curriculum ---------- */
export const unitSchema = z.object({
  id: z.string(),
  lang,
  bands: z.array(band),
  order: z.number().int(),
  titleLocal: z.string().nullable(),
  titleEn: z.string(),
  strand: z.string(),
  note: z.string(),
  wordCount: z.number().int(),
  phraseCount: z.number().int(),
  contentStatus: z.enum(['verified', 'review']),
  progress: z.object({ learned: z.number().int(), total: z.number().int() }),
});
export type Unit = z.infer<typeof unitSchema>;

export const vocabItemSchema = z.object({
  id: z.string(),
  unitId: z.string().nullable(),
  lang,
  kind: z.enum(['word', 'phrase']),
  english: z.string(),
  translation: z.string(),
  audioUrl: z.string().nullable(), // native-speaker recording; null => API voices it with Khaya TTS
  mastery: z.number().int().min(0).max(5).nullable(), // null = never practised
});
export type VocabItem = z.infer<typeof vocabItemSchema>;

/* ---------- Practice ---------- */
export const practiceModeSchema = z.enum(['flashcard', 'choice', 'typing']);
export type PracticeMode = z.infer<typeof practiceModeSchema>;

export const practiceCardSchema = vocabItemSchema.extend({
  distractors: z.array(z.string()), // three wrong answers for multiple choice
  isNew: z.boolean(),
});
export type PracticeCard = z.infer<typeof practiceCardSchema>;

export const nextBatchSchema = z.object({ cards: z.array(practiceCardSchema) });

export const attemptInputSchema = z.object({
  clientId: z.string(), // idempotency key: offline attempts may be sent twice
  itemId: z.string(),
  correct: z.boolean(),
  mode: practiceModeSchema,
  answeredAt: isoDate,
});
export type AttemptInput = z.infer<typeof attemptInputSchema>;

export const attemptResultSchema = z.object({
  itemId: z.string(),
  mastery: z.number().int(),
  nextReviewAt: isoDate,
});
export type AttemptResult = z.infer<typeof attemptResultSchema>;

export const badgeIdSchema = z.enum(['akwaaba', 'nnanson', 'sankofa', 'nyansapo', 'boafo']);
export type BadgeId = z.infer<typeof badgeIdSchema>;

export const progressSummarySchema = z.object({
  streak: z.number().int(),
  longestStreak: z.number().int(),
  learned: z.number().int(),
  mastered: z.number().int(),
  dueCount: z.number().int(),
  newCount: z.number().int(),
  todayCount: z.number().int(),
  totalReviewed: z.number().int(),
  xpThisWeek: z.number().int(),
  history: z.array(z.object({ date: day, count: z.number().int() })), // last 14 days, oldest first
  badges: z.array(z.object({ id: badgeIdSchema, earnedAt: isoDate })),
});
export type ProgressSummary = z.infer<typeof progressSummarySchema>;

/* ---------- Lookup (backed by Khaya AI on the server) ---------- */
export const lookupResultSchema = z.object({
  query: z.string(),
  direction: z.enum(['to_local', 'to_english']),
  result: z
    .object({
      output: z.string(),
      source: z.enum(['curriculum', 'khaya']),
      itemId: z.string().nullable(),
      unitId: z.string().nullable(),
    })
    .nullable(),
  related: z.array(vocabItemSchema),
});
export type LookupResult = z.infer<typeof lookupResultSchema>;

export interface SuggestionInput {
  lang: z.infer<typeof lang>;
  query: string;
  suggestion: string;
  currentTranslation: string | null;
}

/* ---------- Leaderboard ---------- */
export const leaderboardScopeSchema = z.enum(['school', 'region', 'national']);
export type LeaderboardScope = z.infer<typeof leaderboardScopeSchema>;

export const leaderboardEntrySchema = z.object({
  rank: z.number().int(),
  displayName: z.string(),
  school: z.string().nullable(),
  region: z.string().nullable(),
  xp: z.number().int(),
  isMe: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardSchema = z.object({
  scope: leaderboardScopeSchema,
  label: z.string(), // "Prempeh College", "Ashanti Region", "All of Ghana"
  weekStart: day,
  entries: z.array(leaderboardEntrySchema),
  me: leaderboardEntrySchema.nullable(),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;

/* ---------- Community ---------- */
export const authorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: roleSchema,
  levelLabel: z.string().nullable(),
});
export type Author = z.infer<typeof authorSchema>;

/* ---------- Communities ----------
 * Anyone can propose a community. Kasa staff communities go live at once;
 * everyone else's wait in the moderation queue (status "pending").
 * Roles: owner > admin > helper > member. Admin needs an adult account
 * (teacher or Kasa staff). Students can be helpers, or owners of a community
 * they started, but never remove posts or members: they report to Kasa.
 */
export const communityKindSchema = z.enum(['official', 'school', 'class', 'study', 'interest']);
export type CommunityKind = z.infer<typeof communityKindSchema>;

export const joinPolicySchema = z.enum(['open', 'request', 'code']);
export type JoinPolicy = z.infer<typeof joinPolicySchema>;

export const communityRoleSchema = z.enum(['owner', 'admin', 'helper', 'member']);
export type CommunityRole = z.infer<typeof communityRoleSchema>;

export const membershipSchema = z.object({
  status: z.enum(['member', 'pending']),
  role: communityRoleSchema.nullable(), // null while pending
});
export type Membership = z.infer<typeof membershipSchema>;

export const communitySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  kind: communityKindSchema,
  official: z.boolean(), // run by the Kasa team
  lang: lang.nullable(),
  bands: z.array(band), // empty = every level
  joinPolicy: joinPolicySchema,
  status: z.enum(['pending', 'active', 'rejected', 'archived']),
  color: z.enum(['forest', 'gold', 'clay', 'sky']),
  school: z.string().nullable(),
  region: z.string().nullable(),
  memberCount: z.number().int(),
  threadCount: z.number().int(),
  staffOnlyPosting: z.boolean(), // announcements: only community admins and Kasa staff start threads
  createdBy: authorSchema,
  createdAt: isoDate,
  membership: membershipSchema.nullable(), // null = not a member and no pending request
});
export type Community = z.infer<typeof communitySchema>;

export const communityPermissionsSchema = z.object({
  canView: z.boolean(), // open communities are readable by everyone; others by members and staff
  canPost: z.boolean(),
  canManageRequests: z.boolean(), // helper+
  canPin: z.boolean(), // helper+
  canRemovePosts: z.boolean(), // admin+ (adult accounts) and Kasa staff
  canManageMembers: z.boolean(), // admin+: remove members, appoint helpers
  canAppointAdmins: z.boolean(), // owner (adult) and Kasa staff
  canEditSettings: z.boolean(), // owner, admins, Kasa staff
  canLeave: z.boolean(), // false for the owner
});
export type CommunityPermissions = z.infer<typeof communityPermissionsSchema>;

export const communityDetailSchema = communitySchema.extend({
  rules: z.array(z.string()),
  joinCode: z.string().nullable(), // only sent to helpers and above
  pendingRequests: z.number().int(), // 0 unless the viewer can manage requests
  reviewNote: z.string().nullable(), // why Kasa rejected it, shown to the creator
  permissions: communityPermissionsSchema,
});
export type CommunityDetail = z.infer<typeof communityDetailSchema>;

export const communityMemberSchema = z.object({
  user: authorSchema,
  role: communityRoleSchema.nullable(),
  status: z.enum(['member', 'pending']),
  joinedAt: isoDate.nullable(),
  requestedAt: isoDate.nullable(),
  requestNote: z.string().nullable(), // "I'm in JHS 1B with Mr Boateng"
});
export type CommunityMember = z.infer<typeof communityMemberSchema>;

export interface NewCommunityInput {
  name: string; // 4–60
  description: string; // 20–400
  kind: Exclude<CommunityKind, 'official'>;
  lang: 'twi' | 'ga' | null;
  bands: Array<'lp' | 'up' | 'jhs' | 'shs'>;
  joinPolicy: JoinPolicy;
  school: string | null;
  region: string | null;
  rules: string[]; // up to 6, each up to 140
}

export type CommunitySettingsPatch = Partial<
  Pick<NewCommunityInput, 'name' | 'description' | 'joinPolicy' | 'rules' | 'lang' | 'bands'>
>;

export const joinResultSchema = z.object({ community: communitySchema, membership: membershipSchema });

const vote = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
export type VoteValue = z.infer<typeof vote>;

export const threadSummarySchema = z.object({
  id: z.string(),
  communityId: z.string(),
  communityName: z.string(),
  title: z.string(),
  excerpt: z.string(),
  author: authorSchema,
  lang: lang.nullable(),
  tags: z.array(z.string()),
  createdAt: isoDate,
  lastActivityAt: isoDate,
  replyCount: z.number().int(),
  score: z.number().int(),
  myVote: vote,
  hasAcceptedAnswer: z.boolean(),
  pinned: z.boolean(),
  locked: z.boolean(),
});
export type ThreadSummary = z.infer<typeof threadSummarySchema>;

export const replySchema = z.object({
  id: z.string(),
  threadId: z.string(),
  author: authorSchema,
  body: z.string(),
  createdAt: isoDate,
  score: z.number().int(),
  myVote: vote,
  accepted: z.boolean(),
  status: z.enum(['visible', 'removed']),
});
export type Reply = z.infer<typeof replySchema>;

export const threadDetailSchema = threadSummarySchema.extend({
  body: z.string(),
  status: z.enum(['visible', 'removed']),
  replies: z.array(replySchema),
  canAccept: z.boolean(), // thread author, teachers, community admins and Kasa staff
  canModerate: z.boolean(), // pin and lock: community helpers and above
  canRemove: z.boolean(), // remove posts: community admins (adults) and Kasa staff
});
export type ThreadDetail = z.infer<typeof threadDetailSchema>;

export const threadListSchema = z.object({
  items: z.array(threadSummarySchema),
  nextCursor: z.string().nullable(),
});
export type ThreadList = z.infer<typeof threadListSchema>;

export type ThreadSort = 'active' | 'new' | 'top' | 'unanswered';

export interface NewThreadInput {
  communityId: string;
  title: string;
  body: string;
  tags: string[];
}

export const reportReasonSchema = z.enum([
  'spam',
  'bullying',
  'inappropriate',
  'personal_info',
  'wrong_translation',
  'other',
]);
export type ReportReason = z.infer<typeof reportReasonSchema>;

export interface ReportInput {
  targetType: 'thread' | 'reply';
  targetId: string;
  reason: ReportReason;
  note: string;
}

/* ---------- Community admin ---------- */
export const adminOverviewSchema = z.object({
  stats: z.object({
    activeLearners7d: z.number().int(),
    newSignups7d: z.number().int(),
    postsToday: z.number().int(),
    openReports: z.number().int(),
    pendingSuggestions: z.number().int(),
    verifiedTeachers: z.number().int(),
    pendingCommunities: z.number().int(),
    activeCommunities: z.number().int(),
  }),
  signupsByDay: z.array(z.object({ date: day, count: z.number().int() })), // last 14 days
  languageSplit: z.array(z.object({ lang, learners: z.number().int() })),
  topRegions: z.array(z.object({ region: z.string(), learners: z.number().int() })),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const reportSchema = z.object({
  id: z.string(),
  targetType: z.enum(['thread', 'reply']),
  targetId: z.string(),
  threadId: z.string(),
  targetExcerpt: z.string(),
  targetAuthor: authorSchema,
  reason: reportReasonSchema,
  note: z.string(),
  reportCount: z.number().int(), // how many people reported the same content
  reportedBy: z.string(),
  createdAt: isoDate,
  status: z.enum(['open', 'resolved', 'dismissed']),
  resolution: z.string().nullable(),
});
export type Report = z.infer<typeof reportSchema>;

export const reportActionSchema = z.enum(['dismiss', 'remove_content', 'warn_user', 'suspend_user']);
export type ReportAction = z.infer<typeof reportActionSchema>;

export const suggestionSchema = z.object({
  id: z.string(),
  lang,
  query: z.string(),
  currentTranslation: z.string().nullable(),
  suggestion: z.string(),
  submittedBy: z.string(),
  supporters: z.number().int(), // other learners who suggested the same thing
  createdAt: isoDate,
  status: z.enum(['pending', 'approved', 'rejected']),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

export interface SuggestionReview {
  decision: 'approve' | 'reject';
  finalTranslation?: string;
}

export const adminUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  role: roleSchema,
  status: z.enum(['active', 'suspended']),
  levelLabel: z.string(),
  lang,
  region: z.string().nullable(),
  school: z.string().nullable(),
  createdAt: isoDate,
  lastActiveAt: isoDate,
  reportsAgainst: z.number().int(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const voteResultSchema = z.object({ score: z.number().int(), myVote: vote });
export type VoteResult = z.infer<typeof voteResultSchema>;

/* ---------- Notifications ---------- */
export const notificationKindSchema = z.enum([
  'join_request', // to a community's helpers and above
  'join_approved',
  'join_declined',
  'community_approved', // to the creator
  'community_rejected',
  'role_changed',
  'reply', // someone answered your question
  'answer_accepted',
  'badge',
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string(),
  href: z.string().nullable(), // in-app path, e.g. "/community/c/asafo-jhs1b"
  createdAt: isoDate,
  read: z.boolean(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int(),
});
export type NotificationList = z.infer<typeof notificationListSchema>;

/* ---------- Home ---------- */
export const dailyFeatureSchema = z.object({ kicker: z.string(), local: z.string(), english: z.string() });
export type DailyFeature = z.infer<typeof dailyFeatureSchema>;

export const okSchema = z.object({ ok: z.literal(true) });
