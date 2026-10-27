import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { canModerate, useUser } from '@/features/auth/session';
import { ApiError } from '@/shared/api/client';
import type { Community, CommunityDetail, JoinPolicy, NewCommunityInput } from '@/shared/api/schemas';
import { LANGUAGE_LIST } from '@/shared/config/languages';
import { BANDS, getLevel } from '@/shared/config/levels';
import { REGIONS } from '@/shared/config/regions';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { checkPostSafety } from '@/shared/lib/safety';
import {
  Button,
  ButtonLink,
  Column,
  EmptyState,
  Notice,
  PageHeader,
  SelectField,
  Split,
  TextArea,
  TextField,
  errorMessage,
  toast,
} from '@/shared/ui';
import { POLICY_HINT, useCreateCommunity } from '../api';
import { CommunityCard } from '../components/CommunityBits';
import { RuleEditor } from '../components/RuleEditor';
import styles from '../community.module.css';

type Kind = NewCommunityInput['kind'];
type Band = NewCommunityInput['bands'][number];

const KINDS: Array<{ value: Kind; label: string; hint: string }> = [
  { value: 'class', label: 'Class', hint: 'One class and its teacher, e.g. “Asafo JHS 1B Twi”.' },
  { value: 'school', label: 'School', hint: 'Everyone learning Twi or Ga at one school.' },
  { value: 'study', label: 'Study group', hint: 'Friends revising together for the BECE or WASSCE.' },
  {
    value: 'interest',
    label: 'Interest group',
    hint: 'People who love proverbs, stories, music or a region.',
  },
];

const POLICIES: Array<{ value: JoinPolicy; label: string; hint: string }> = [
  {
    value: 'code',
    label: 'Class code',
    hint: 'Best for classes. Share a short code or link and only people with it can join.',
  },
  {
    value: 'request',
    label: 'Ask to join',
    hint: 'Anyone can ask. You or your helpers approve each request.',
  },
  { value: 'open', label: 'Open', hint: 'Anyone can join straight away. Good for big interest groups.' },
];

const STARTER_RULES = ['Be kind and patient', 'Explain your answers', 'Never share phone numbers or meet up'];
const STEPS = ['About', 'Who it’s for', 'How people join'] as const;

export default function CreateCommunityPage() {
  useDocumentTitle('Start a community');
  const user = useUser();
  const navigate = useNavigate();
  const create = useCreateCommunity();
  const staff = canModerate(user);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<CommunityDetail | null>(null);
  const [form, setForm] = useState<NewCommunityInput>({
    name: '',
    description: '',
    kind: 'class',
    lang: user.lang,
    bands: [getLevel(user.levelId).band],
    joinPolicy: 'code',
    school: user.school,
    region: user.region,
    rules: STARTER_RULES,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof NewCommunityInput>(k: K, v: NewCommunityInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '', form: '' }));
  };

  const safety = (t: string) => (t.trim() ? checkPostSafety(t) : null);
  const validateStep = (i: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (i === 0) {
      if (form.name.trim().length < 4) e.name = 'Give it a name of at least 4 characters.';
      else if (safety(form.name)) e.name = safety(form.name)!;
      if (form.description.trim().length < 20)
        e.description = 'Describe it in at least 20 characters so people know it’s for them.';
      else if (safety(form.description)) e.description = safety(form.description)!;
    }
    if (i === 2) {
      const bad = form.rules.map(safety).find(Boolean);
      if (bad) e.rules = bad;
    }
    return e;
  };

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (!Object.values(e).some(Boolean)) setStep((s) => s + 1);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (step < STEPS.length - 1) return next();
    const e = { ...validateStep(0), ...validateStep(2) };
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      if (e.name || e.description) setStep(0);
      return;
    }
    create.mutate(
      {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        rules: form.rules.map((r) => r.trim()).filter(Boolean),
      },
      {
        onSuccess: (c) => {
          if (c.status === 'active') {
            toast('Community created.');
            navigate(`/community/c/${c.slug}`);
          } else setDone(c);
        },
        onError: (err) => {
          const fe = err instanceof ApiError ? err.fieldErrors : {};
          setErrors(Object.keys(fe).length ? fe : { form: errorMessage(err) });
          if (fe.name || fe.description) setStep(0);
        },
      },
    );
  };

  if (done) {
    return (
      <>
        <PageHeader backTo="/community" title="Sent for review" />
        <EmptyState
          icon="check"
          title={`${done.name} is waiting for Kasa review`}
          action={
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <ButtonLink to={`/community/c/${done.slug}`} size="sm">
                See your community
              </ButtonLink>
              <ButtonLink to="/community" size="sm" variant="ghost">
                Back to Community
              </ButtonLink>
            </div>
          }
        >
          A Kasa moderator will check it before it goes live; we’ll notify you. Meanwhile you can set up rules
          and get your class code ready.
        </EmptyState>
      </>
    );
  }

  const preview: Community = {
    id: 'preview',
    slug: 'preview',
    name: form.name.trim() || 'Your community name',
    description: form.description.trim() || 'Your description shows here, so people know if it’s for them.',
    kind: form.kind,
    official: false,
    lang: form.lang,
    bands: form.bands,
    joinPolicy: form.joinPolicy,
    status: 'active',
    color: 'forest',
    school: form.school,
    region: form.region,
    memberCount: 1,
    threadCount: 0,
    staffOnlyPosting: false,
    createdBy: { id: user.id, displayName: user.displayName, role: user.role, levelLabel: null },
    createdAt: new Date().toISOString(),
    membership: null,
  };

  return (
    <>
      <PageHeader
        backTo="/community"
        title="Start a community"
        subtitle="For your class, school, study group or club."
      />
      <ol className={styles.steps} aria-label="Steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            data-state={i < step ? 'done' : i === step ? 'current' : 'todo'}
            aria-current={i === step ? 'step' : undefined}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <Split variant="aside">
        <Column>
          <form className={styles.panel} onSubmit={submit} noValidate>
            {step === 0 && (
              <>
                <TextField
                  label="Name"
                  hint="Include your school or town so people find it, e.g. “Asafo JHS 1B Twi”."
                  value={form.name}
                  maxLength={60}
                  onChange={(e) => set('name', e.target.value)}
                  error={errors.name}
                  autoFocus
                />
                <TextArea
                  label="What’s it for?"
                  value={form.description}
                  maxLength={400}
                  rows={4}
                  onChange={(e) => set('description', e.target.value)}
                  error={errors.description}
                />
                <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="small" style={{ fontWeight: 700, marginBottom: 8 }}>
                    Kind of community
                  </legend>
                  <div className={styles.choiceGrid}>
                    {KINDS.map((k) => (
                      <label key={k.value} className={styles.choice}>
                        <input
                          type="radio"
                          name="kind"
                          checked={form.kind === k.value}
                          onChange={() => set('kind', k.value)}
                        />
                        <span>
                          <strong>{k.label}</strong>
                          <span className="small muted">{k.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {step === 1 && (
              <>
                <SelectField
                  label="Language"
                  value={form.lang ?? ''}
                  onChange={(e) => set('lang', (e.target.value || null) as NewCommunityInput['lang'])}
                >
                  {LANGUAGE_LIST.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.fullName}
                    </option>
                  ))}
                  <option value="">Both Twi and Ga</option>
                </SelectField>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="small" style={{ fontWeight: 700, marginBottom: 8 }}>
                    Levels (leave all unticked for every class)
                  </legend>
                  <div className={styles.choiceGrid}>
                    {BANDS.map((b) => (
                      <label key={b.id} className={styles.choice}>
                        <input
                          type="checkbox"
                          checked={form.bands.includes(b.id as Band)}
                          onChange={(e) =>
                            set(
                              'bands',
                              e.target.checked
                                ? [...form.bands, b.id as Band]
                                : form.bands.filter((x) => x !== b.id),
                            )
                          }
                        />
                        <span>
                          <strong>{b.name}</strong>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <TextField
                  label="School (optional)"
                  value={form.school ?? ''}
                  maxLength={80}
                  onChange={(e) => set('school', e.target.value || null)}
                  error={errors.school}
                />
                <SelectField
                  label="Region (optional)"
                  value={form.region ?? ''}
                  onChange={(e) => set('region', e.target.value || null)}
                >
                  <option value="">Not set</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </SelectField>
              </>
            )}

            {step === 2 && (
              <>
                <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="small" style={{ fontWeight: 700, marginBottom: 8 }}>
                    How do people join?
                  </legend>
                  {POLICIES.map((p) => (
                    <label key={p.value} className={styles.choice}>
                      <input
                        type="radio"
                        name="policy"
                        checked={form.joinPolicy === p.value}
                        onChange={() => set('joinPolicy', p.value)}
                      />
                      <span>
                        <strong>{p.label}</strong>
                        <span className="small muted">{p.hint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <RuleEditor rules={form.rules} onChange={(r) => set('rules', r)} error={errors.rules} />
              </>
            )}

            {errors.form && (
              <Notice tone="danger" title="Your community wasn’t created">
                {errors.form}
              </Notice>
            )}
            <div className="row-between">
              {step > 0 ? (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" loading={create.isPending}>
                {step < STEPS.length - 1 ? 'Continue' : staff ? 'Create community' : 'Send for review'}
              </Button>
            </div>
          </form>
        </Column>
        <Column sticky>
          <span className="eyebrow">Preview</span>
          <CommunityCard community={preview} />
          <p className="small muted">{POLICY_HINT[form.joinPolicy]}.</p>
          {!staff && (
            <Notice title="Kasa checks every new community">
              <span className="small">
                A moderator reviews it before it goes live, usually within a day. You’ll be its owner.{' '}
                {user.role === 'student'
                  ? 'You can make classmates helpers. Removing posts or members is done by teachers and Kasa moderators.'
                  : 'You can add other teachers as admins.'}{' '}
                <Link to="/community/guidelines">Community rules</Link>
              </span>
            </Notice>
          )}
        </Column>
      </Split>
    </>
  );
}
