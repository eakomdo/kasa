import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { canModerate, useUser } from '@/features/auth/session';
import { ApiError } from '@/shared/api/client';
import { useDocumentTitle } from '@/shared/lib/hooks';
import {
  Button,
  Notice,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
  errorMessage,
  toast,
} from '@/shared/ui';
import { TAG_LABELS, TAG_OPTIONS, useCreateThread, useMyCommunities } from '../api';
import { checkPostSafety } from '@/shared/lib/safety';
import styles from '../community.module.css';

type Errors = Partial<Record<'communityId' | 'title' | 'body' | 'form', string>>;

export default function NewThreadPage() {
  useDocumentTitle('Ask a question');
  const user = useUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mine = useMyCommunities();
  const create = useCreateThread();
  const staff = canModerate(user);
  // Communities you can post in; the server has the final say
  const options = (mine.data ?? []).filter(
    (c) =>
      c.status === 'active' &&
      c.membership?.status === 'member' &&
      (!c.staffOnlyPosting || staff || c.membership.role === 'admin' || c.membership.role === 'owner'),
  );

  const [communityId, setCommunityId] = useState(params.get('community') ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  // Warn as they type, not only on submit, so learners fix it before posting
  const liveTitle = title ? checkPostSafety(title) : null;
  const liveBody = body ? checkPostSafety(body) : null;

  const toggleTag = (tag: string) =>
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : t.length >= 4 ? t : [...t, tag]));

  const validate = (): Errors => {
    const e: Errors = {};
    if (!options.some((c) => c.id === communityId)) e.communityId = 'Choose a community you’ve joined.';
    if (title.trim().length < 8)
      e.title = 'Make your title a little longer so people know what you’re asking (8 characters or more).';
    else e.title = checkPostSafety(title) ?? undefined;
    if (body.trim().length < 10) e.body = 'Add a few more details (10 characters or more).';
    else e.body = checkPostSafety(body) ?? undefined;
    return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Errors;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    create.mutate(
      { communityId, title: title.trim(), body: body.trim(), tags },
      {
        onSuccess: (thread) => {
          toast('Question posted. You’ll see answers here.');
          navigate(`/community/t/${thread.id}`, { replace: true });
        },
        onError: (err) =>
          setErrors(
            err instanceof ApiError && Object.keys(err.fieldErrors).length
              ? (err.fieldErrors as Errors)
              : { form: errorMessage(err) },
          ),
      },
    );
  };

  if (user.status === 'suspended') {
    return (
      <>
        <PageHeader backTo="/community" title="Ask a question" />
        <Notice tone="warn" title="Posting is paused on your account">
          A moderator paused your community posting. You can still read discussions and keep learning.
        </Notice>
      </>
    );
  }

  return (
    <>
      <PageHeader
        backTo={params.get('community') ? `/community/c/${params.get('community')}` : '/community'}
        title="Ask a question"
        subtitle="Students and teachers across Ghana can help."
      />
      <div className={styles.wide}>
        <>
          <form className="stack" onSubmit={submit} noValidate>
            <SelectField
              label="Community"
              hint={
                <>
                  Only communities you’ve joined are listed. <Link to="/community/discover">Find more</Link>
                </>
              }
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              error={errors.communityId}
            >
              <option value="">Choose a community</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Title"
              hint="One clear question, e.g. “How do I say ‘good morning’ to an elder?”"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title ?? liveTitle ?? undefined}
            />
            <TextArea
              label="Details"
              hint="Say what you’ve tried or where you saw the word. It helps people give a better answer."
              value={body}
              maxLength={4000}
              rows={7}
              onChange={(e) => setBody(e.target.value)}
              error={errors.body ?? liveBody ?? undefined}
            />
            <div className="stack-sm">
              <span className="small" style={{ fontWeight: 700 }} id="tags-label">
                Topics (up to 4)
              </span>
              <div className={styles.tagToggle} role="group" aria-labelledby="tags-label">
                {TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                  >
                    {TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
            </div>
            {errors.form && (
              <Notice tone="danger" title="Your question wasn’t posted">
                {errors.form}
              </Notice>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" loading={create.isPending}>
                Post question
              </Button>
            </div>
          </form>
        </>
        <>
          <section className={styles.panel}>
            <h2>Before you post</h2>
            <ul
              className="small"
              style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <li>Search first. Your question may already have an answer.</li>
              <li>Ask about learning, not for someone to do your homework.</li>
              <li>Never share your phone number, email, address or social media.</li>
              <li>Be kind. Everyone here is still learning.</li>
            </ul>
            <Link to="/community/guidelines" className="small">
              Read all the community rules
            </Link>
          </section>
        </>
      </div>
    </>
  );
}
