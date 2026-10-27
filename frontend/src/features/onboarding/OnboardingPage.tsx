import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useUpdateMe } from '@/features/auth/api';
import { AuthLayout, Stepper } from '@/features/auth/AuthLayout';
import { useUser } from '@/features/auth/session';
import { isEmail } from '@/features/auth/validation';
import { ApiError } from '@/shared/api/client';
import type { UserPatch } from '@/shared/api/schemas';
import { LANGUAGE_LIST } from '@/shared/config/languages';
import { BANDS, LEVELS, getBand, getLevel, needsGuardian } from '@/shared/config/levels';
import { REGIONS } from '@/shared/config/regions';
import { track } from '@/shared/lib/analytics';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { Button, Chip, IconLink, Notice, SelectField, TextField, errorMessage, toast } from '@/shared/ui';
import styles from './Onboarding.module.css';

const STEPS = ['language', 'level', 'goal', 'school'] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const { step } = useParams();
  if (!STEPS.includes(step as Step)) return <Navigate to="/onboarding/language" replace />;
  return <OnboardingStep step={step as Step} />;
}

function OnboardingStep({ step }: { step: Step }) {
  const user = useUser();
  const navigate = useNavigate();
  const update = useUpdateMe();
  const index = STEPS.indexOf(step);
  const prev = STEPS[index - 1];
  const next = STEPS[index + 1];
  useDocumentTitle('Set up Kasa');

  const save = (patch: UserPatch, go?: string) =>
    update.mutate(patch, {
      onSuccess: () => go && navigate(go),
      onError: (e) => toast(errorMessage(e), 'error'),
    });

  return (
    <AuthLayout>
      <div className="row">
        {prev ? <IconLink to={`/onboarding/${prev}`} icon="back" label="Back" /> : null}
        <h1>{TITLES[step]}</h1>
      </div>
      <Stepper step={index + 2} total={STEPS.length + 1} />

      {step === 'language' && (
        <>
          <div className={styles.choices}>
            {LANGUAGE_LIST.map((l) => (
              <button
                key={l.id}
                type="button"
                className={styles.choice}
                aria-pressed={user.lang === l.id}
                onClick={() => save({ lang: l.id })}
              >
                <span className={styles.glyph}>{l.name.slice(0, 2)}</span>
                <span className={styles.text}>
                  <b>{l.fullName}</b>
                  <span>{l.blurb}</span>
                </span>
                {l.status === 'review' && <Chip tone="warn">In review</Chip>}
              </button>
            ))}
          </div>
          <p className="small muted">You can add the other language later from Settings.</p>
          <Button block onClick={() => navigate(`/onboarding/${next}`)}>
            Continue
          </Button>
        </>
      )}

      {step === 'level' && (
        <>
          <p className="muted">Lessons follow the GES Ghanaian Language curriculum for your class.</p>
          {BANDS.map((b) => (
            <section key={b.id} className={styles.band} aria-label={b.name}>
              <p className="eyebrow">{b.name}</p>
              <div className={styles.levels}>
                {LEVELS.filter((l) => l.band === b.id).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={styles.level}
                    aria-pressed={user.levelId === l.id}
                    onClick={() => save({ levelId: l.id })}
                  >
                    {l.short}
                    {l.gesCode && <small>{l.gesCode}</small>}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <Button block onClick={() => navigate(`/onboarding/${next}`)}>
            Continue
          </Button>
        </>
      )}

      {step === 'goal' && (
        <>
          <p className="muted">Small and daily beats long and rare. You can change this any time.</p>
          <div className={styles.choices}>
            {[
              [10, 'Easy does it', 'about 5 minutes'],
              [20, 'Steady', 'about 10 minutes'],
              [30, getBand(getLevel(user.levelId).band).topGoalLabel, 'about 15 minutes'],
            ].map(([n, title, time]) => (
              <button
                key={n}
                type="button"
                className={styles.choice}
                aria-pressed={user.dailyGoal === n}
                onClick={() => save({ dailyGoal: n as number })}
              >
                <span className={styles.glyph}>{n}</span>
                <span className={styles.text}>
                  <b>{title}</b>
                  <span>
                    {n} cards a day, {time}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Button block onClick={() => navigate(`/onboarding/${next}`)}>
            Continue
          </Button>
        </>
      )}

      {step === 'school' && (
        <SchoolStep
          onDone={(patch) => {
            track('onboarding_completed', {
              lang: user.lang,
              level: user.levelId,
              goal: user.dailyGoal,
              hasSchool: !!patch.school,
            });
            save({ ...patch, onboarded: true }, '/');
          }}
          saving={update.isPending}
          error={update.error}
        />
      )}
    </AuthLayout>
  );
}

const TITLES: Record<Step, string> = {
  language: 'Which language?',
  level: 'Your class',
  goal: 'Daily goal',
  school: 'Your school',
};

function SchoolStep({
  onDone,
  saving,
  error,
}: {
  onDone: (p: UserPatch) => void;
  saving: boolean;
  error: unknown;
}) {
  const user = useUser();
  const guardianNeeded = needsGuardian(getLevel(user.levelId));
  const [school, setSchool] = useState(user.school ?? '');
  const [region, setRegion] = useState(user.region ?? '');
  const [guardian, setGuardian] = useState(user.guardianEmail ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const server = error instanceof ApiError ? error.fieldErrors : {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (guardianNeeded && !isEmail(guardian))
      errs.guardianEmail = 'Primary pupils need a parent or guardian’s email so they can see progress.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onDone({ school: school.trim() || null, region: region || null, guardianEmail: guardian.trim() || null });
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p className="muted">
        This puts you on your school's weekly leaderboard. It's optional, and only your first name and initial
        are shown.
      </p>
      <TextField
        label="School name"
        placeholder="e.g. Asafo M/A JHS"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
        error={server.school}
        autoComplete="organization"
      />
      <SelectField
        label="Region"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
        error={server.region}
      >
        <option value="">Choose your region</option>
        {REGIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </SelectField>
      {guardianNeeded && (
        <>
          <Notice title="For primary pupils">
            A parent or guardian gets a weekly progress email and can ask us to delete the account at any
            time.
          </Notice>
          <TextField
            label="Parent or guardian’s email"
            type="email"
            inputMode="email"
            value={guardian}
            onChange={(e) => setGuardian(e.target.value)}
            error={errors.guardianEmail ?? server.guardianEmail}
          />
        </>
      )}
      <Button type="submit" variant="gold" block loading={saving}>
        Start learning
      </Button>
    </form>
  );
}
