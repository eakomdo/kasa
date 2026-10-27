import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useLogout, useUpdateMe } from '@/features/auth/api';
import { useSession, useUser } from '@/features/auth/session';
import { isEmail } from '@/features/auth/validation';
import { unitTitle, useUnits } from '@/features/curriculum/api';
import { ApiError } from '@/shared/api/client';
import type { User, UserPatch } from '@/shared/api/schemas';
import { env } from '@/shared/config/env';
import { isEnabled } from '@/shared/config/flags';
import { LANGUAGE_LIST } from '@/shared/config/languages';
import { BANDS, LEVELS, getLevel, levelLabel, needsGuardian } from '@/shared/config/levels';
import { REGIONS } from '@/shared/config/regions';
import { useDocumentTitle } from '@/shared/lib/hooks';
import {
  Button,
  IconButton,
  PageHeader,
  Segmented,
  SelectField,
  Switch,
  TextField,
  errorMessage,
  toast,
} from '@/shared/ui';
import { FREE_OFFLINE_UNITS, useDevicePrefs, type ThemePref } from './devicePrefs';

const TIMES = ['06:00', '07:00', '15:30', '17:00', '18:00', '19:00', '20:00'];

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const user = useUser();
  const update = useUpdateMe();

  const save = (patch: UserPatch, message = 'Saved.') =>
    update.mutate(patch, {
      onSuccess: () => toast(message),
      onError: (e) => toast(errorMessage(e), 'error'),
    });

  return (
    <>
      <PageHeader title="Settings" backTo="/profile" />
      <div className="stack" style={{ gap: 48, maxWidth: 'var(--reading-max)' }}>
        <Section title="Learning">
          <SelectField
            label="Language"
            value={user.lang}
            onChange={(e) => save({ lang: e.target.value as User['lang'] }, 'Language changed.')}
          >
            {LANGUAGE_LIST.map((l) => (
              <option key={l.id} value={l.id}>
                {l.fullName}
                {l.status === 'review' ? ' (in review)' : ''}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Class"
            value={user.levelId}
            onChange={(e) => save({ levelId: e.target.value as User['levelId'] }, 'Class changed.')}
          >
            {BANDS.map((b) => (
              <optgroup key={b.id} label={b.name}>
                {LEVELS.filter((l) => l.band === b.id).map((l) => (
                  <option key={l.id} value={l.id}>
                    {levelLabel(l)}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <SelectField
            label="Daily goal"
            value={user.dailyGoal}
            onChange={(e) => save({ dailyGoal: Number(e.target.value) })}
          >
            {[5, 10, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n} cards a day
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Pronunciation voice"
            hint="Used when a word has no native-speaker recording yet"
            value={user.voice}
            onChange={(e) => save({ voice: e.target.value as User['voice'] })}
          >
            <option value="female">Female</option>
            <option value="male_low">Male, low</option>
            <option value="male_high">Male, high</option>
          </SelectField>
        </Section>

        <SchoolSection user={user} saving={update.isPending} onSave={(p) => save(p)} error={update.error} />

        <Section title="Reminders">
          <Switch
            label="Daily reminder"
            description="A nudge only on days you haven’t practised"
            checked={user.reminder.enabled}
            onChange={(enabled) =>
              save(
                { reminder: { ...user.reminder, enabled } },
                enabled ? `Reminder set for ${user.reminder.time}.` : 'Reminder off.',
              )
            }
          />
          {user.reminder.enabled && (
            <>
              <SelectField
                label="Send by"
                value={user.reminder.channel}
                onChange={(e) =>
                  save({
                    reminder: { ...user.reminder, channel: e.target.value as User['reminder']['channel'] },
                  })
                }
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="push">App notification</option>
              </SelectField>
              <SelectField
                label="Time"
                value={user.reminder.time}
                onChange={(e) => save({ reminder: { ...user.reminder, time: e.target.value } })}
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectField>
            </>
          )}
        </Section>
        <DeviceSection plan={user.plan} />
        <PlusSection plan={user.plan} />
        <AccountSection email={user.email} />
      </div>
    </>
  );
}

/** A settings group: a quiet heading and its fields, separated by space rather than boxes. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: 20 }}>
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function SchoolSection({
  user,
  saving,
  onSave,
  error,
}: {
  user: User;
  saving: boolean;
  onSave: (p: UserPatch) => void;
  error: unknown;
}) {
  const [school, setSchool] = useState(user.school ?? '');
  const [region, setRegion] = useState(user.region ?? '');
  const [guardian, setGuardian] = useState(user.guardianEmail ?? '');
  const [localError, setLocalError] = useState<string>();
  const server = error instanceof ApiError ? error.fieldErrors : {};
  const showGuardian = needsGuardian(getLevel(user.levelId)) || !!user.guardianEmail;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (showGuardian && guardian.trim() && !isEmail(guardian)) {
      setLocalError('Check the parent or guardian’s email address.');
      return;
    }
    setLocalError(undefined);
    onSave({ school: school.trim() || null, region: region || null, guardianEmail: guardian.trim() || null });
  };

  return (
    <form className="stack" style={{ gap: 20 }} onSubmit={submit}>
      <h2 className="eyebrow">School and family</h2>
      <TextField
        label="School name"
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
        <option value="">Not set</option>
        {REGIONS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </SelectField>
      {showGuardian && (
        <TextField
          label="Parent or guardian’s email"
          hint="They get a weekly progress email"
          type="email"
          value={guardian}
          onChange={(e) => setGuardian(e.target.value)}
          error={localError ?? server.guardianEmail}
        />
      )}
      <Button type="submit" size="sm" loading={saving}>
        Save
      </Button>
    </form>
  );
}

function DeviceSection({ plan }: { plan: User['plan'] }) {
  const prefs = useDevicePrefs();
  const units = useUnits();
  const saved = prefs.offlineUnitIds;
  const titleOf = (id: string) => {
    const u = units.data?.find((x) => x.id === id);
    return u ? unitTitle(u) : id;
  };
  return (
    <section className="stack" style={{ gap: 20 }}>
      <h2 className="eyebrow">This phone</h2>
      <div className="stack-sm">
        <span className="small" style={{ fontWeight: 700 }}>
          Appearance
        </span>
        <Segmented<ThemePref>
          full
          label="Appearance"
          value={prefs.theme}
          onChange={prefs.setTheme}
          options={[
            { value: 'system', label: 'Automatic' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </div>
      <Switch
        label="Data saver"
        description="Audio downloads only when you tap play"
        checked={prefs.dataSaver}
        onChange={prefs.setDataSaver}
      />
      <div className="stack-sm">
        <span className="small" style={{ fontWeight: 700 }}>
          Saved for offline ({saved.length}
          {plan === 'free' ? ` of ${FREE_OFFLINE_UNITS}` : ''})
        </span>
        {saved.length === 0 ? (
          <p className="small muted">No units saved yet. Open a unit and tap “Save for offline”.</p>
        ) : (
          <ul className="stack-sm" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {saved.map((id) => (
              <li key={id} className="row-between">
                <span>{titleOf(id)}</span>
                <IconButton
                  icon="close"
                  label={`Remove ${titleOf(id)} from this phone`}
                  onClick={() => prefs.toggleOfflineUnit(id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AccountSection({ email }: { email: string }) {
  const logout = useLogout();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clear = useSession((s) => s.clear);
  const [confirmReset, setConfirmReset] = useState(false);

  const resetDemo = async () => {
    const { resetDb } = await import('@/shared/api/mock/db');
    resetDb();
    clear();
    qc.clear();
    navigate('/welcome', { replace: true });
  };

  return (
    <section className="stack" style={{ gap: 20 }}>
      <h2 className="eyebrow">Account</h2>
      <p className="small muted">Signed in as {email}</p>
      <Button
        variant="ghost"
        size="sm"
        icon="logout"
        onClick={() => logout.mutate()}
        loading={logout.isPending}
      >
        Sign out
      </Button>
      {env.useMocks &&
        (confirmReset ? (
          <div className="stack-sm">
            <p className="small">This clears all sample progress, posts and accounts in this browser.</p>
            <div className="row">
              <Button variant="danger" size="sm" onClick={() => void resetDemo()}>
                Reset preview data
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="subtle" size="sm" onClick={() => setConfirmReset(true)}>
            Reset preview data
          </Button>
        ))}
      <p className="small muted">
        Kasa stores only what it needs to teach you: your name, email, class and progress. Ask us any time to
        export or delete your data.
      </p>
    </section>
  );
}

/** Kasa Plus, paid per term with Mobile Money. Checkout is behind the mobileMoney flag. */
function PlusSection({ plan }: { plan: User['plan'] }) {
  const [asked, setAsked] = useState(false);
  return (
    <section className="stack" style={{ gap: 16 }}>
      <h2 className="eyebrow">Kasa Plus</h2>
      <p>
        {plan === 'plus'
          ? 'You have Kasa Plus.'
          : 'Every unit offline, BECE and WASSCE mock tests, and WhatsApp reminders.'}{' '}
        <span className="muted">GH₵ 25 a term, paid with MTN MoMo, Telecel Cash or AT Money.</span>
      </p>
      {plan !== 'plus' &&
        (asked || !isEnabled('mobileMoney') ? (
          <p className="small muted">
            Mobile Money payments aren’t switched on yet. The price shown is an example.
          </p>
        ) : (
          <div>
            <Button variant="ghost" onClick={() => setAsked(true)}>
              Upgrade with Mobile Money
            </Button>
          </div>
        ))}
    </section>
  );
}
