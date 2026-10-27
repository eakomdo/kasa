import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { Button, Notice, PageHeader, TextField, errorMessage, toast } from '@/shared/ui';
import { useJoinByCode } from '../api';
import styles from '../community.module.css';

/** Join a class with the code a teacher shares, or from a link like /community/join?code=ASF-7B. */
export default function JoinCommunityPage() {
  useDocumentTitle('Join with a code');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const join = useJoinByCode();
  const fromLink = (params.get('code') ?? '').toUpperCase().trim();
  const [code, setCode] = useState(fromLink);
  const [error, setError] = useState<string>();
  const autoSubmitted = useRef(false);

  const submit = (value: string) => {
    const clean = value.trim();
    if (!clean) return setError('Type the class code your teacher gave you.');
    join.mutate(clean, {
      onSuccess: ({ community }) => {
        toast(`Welcome to ${community.name}!`);
        navigate(`/community/c/${community.slug}`, { replace: true });
      },
      onError: (e) => setError(errorMessage(e)),
    });
  };

  // A teacher's link fills the code in; join once automatically so it is one tap from WhatsApp
  useEffect(() => {
    if (fromLink && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit(fromLink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLink]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(code);
  };

  return (
    <>
      <PageHeader
        backTo="/community"
        title="Join with a code"
        subtitle="For classes and school communities."
      />
      <div className={styles.wide}>
        <>
          <section className={styles.panel}>
            <form className="stack" onSubmit={onSubmit} noValidate>
              <TextField
                label="Class code"
                hint="It looks like ASF-7B. Capital letters or small, it doesn’t matter."
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(undefined);
                }}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                className={styles.codeInput}
                error={error}
                autoFocus={!fromLink}
              />
              <Button type="submit" block loading={join.isPending}>
                Join community
              </Button>
            </form>
          </section>
        </>
        <>
          <Notice title="Where do I get a code?">
            <span className="small">
              Your teacher or the person who runs the community shares it, in class or as a link. Codes only
              work for communities a Kasa moderator has approved.
            </span>
          </Notice>
        </>
      </div>
    </>
  );
}
