import { useState, type FormEvent } from 'react';
import { ApiError } from '@/shared/api/client';
import { Button, TextArea, errorMessage, toast } from '@/shared/ui';
import { useReply } from '../api';
import { checkPostSafety } from '@/shared/lib/safety';
import styles from '../community.module.css';

const MAX = 2000;

export function ReplyComposer({
  threadId,
  isQuestionAuthor,
}: {
  threadId: string;
  isQuestionAuthor: boolean;
}) {
  const [body, setBody] = useState('');
  const [serverError, setServerError] = useState<string>();
  const reply = useReply(threadId);
  const safety = body.trim() ? checkPostSafety(body) : null;
  const tooShort = body.trim().length < 2;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tooShort || safety) return;
    setServerError(undefined);
    reply.mutate(body.trim(), {
      onSuccess: () => {
        setBody('');
        toast('Reply posted. Medaase for helping!');
      },
      onError: (err) =>
        setServerError(err instanceof ApiError ? (err.fieldErrors.body ?? err.message) : errorMessage(err)),
    });
  };

  return (
    <form className={styles.composer} onSubmit={submit} noValidate>
      <TextArea
        label={isQuestionAuthor ? 'Add more detail or say thanks' : 'Your answer'}
        hint="Explain how you know, so others learn too."
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setServerError(undefined);
        }}
        maxLength={MAX}
        rows={4}
        error={safety ?? serverError}
        placeholder="Write your answer…"
      />
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button type="submit" loading={reply.isPending} disabled={tooShort || !!safety}>
          Post reply
        </Button>
      </div>
    </form>
  );
}
