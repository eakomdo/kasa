import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '@/shared/api/client';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { Button, IconLink, Notice, TextField, errorMessage } from '@/shared/ui';
import { AuthLayout } from '../AuthLayout';
import { useLogin } from '../api';

export default function LoginPage() {
  useDocumentTitle('Log in');
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = 'Enter the email you signed up with.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;
    // <GuestOnly> redirects to the page the learner came from once the session exists.
    login.mutate({ email: email.trim(), password });
  };

  const fieldErrors = login.error instanceof ApiError ? login.error.fieldErrors : {};
  const formError = login.error && !Object.keys(fieldErrors).length ? errorMessage(login.error) : null;

  return (
    <AuthLayout>
      <div className="row">
        <IconLink to="/welcome" icon="back" label="Back" />
        <h1>Welcome back</h1>
      </div>
      <p className="muted">Log in to pick up where you left off.</p>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email ?? fieldErrors.email}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password ?? fieldErrors.password}
          required
        />
        {formError && <Notice tone="danger">{formError}</Notice>}
        <Button type="submit" block loading={login.isPending}>
          Log in
        </Button>
      </form>
      <p className="small muted" style={{ textAlign: 'center' }}>
        New to Kasa? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
