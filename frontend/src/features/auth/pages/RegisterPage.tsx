import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '@/shared/api/client';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { Button, IconLink, Notice, TextField, errorMessage } from '@/shared/ui';
import { AuthLayout, Stepper } from '../AuthLayout';
import { useRegister } from '../api';
import { validateRegistration } from '../validation';

export default function RegisterPage() {
  useDocumentTitle('Create your account');
  const register = useRegister();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [k]: e.target.value });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = validateRegistration(values);
    setErrors(next);
    if (Object.keys(next).length) return;
    // <GuestOnly> sends new accounts to onboarding once the session exists.
    register.mutate({ name: values.name.trim(), email: values.email.trim(), password: values.password });
  };

  const serverErrors = register.error instanceof ApiError ? register.error.fieldErrors : {};
  const formError = register.error && !Object.keys(serverErrors).length ? errorMessage(register.error) : null;

  return (
    <AuthLayout>
      <div className="row">
        <IconLink to="/welcome" icon="back" label="Back" />
        <h1>Create your account</h1>
      </div>
      <Stepper step={1} total={5} />
      <p className="muted">
        Your progress saves to your account, so you can switch phones without losing your streak. Parents and
        guardians can sign up for younger learners.
      </p>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <TextField
          label="First name"
          autoComplete="given-name"
          placeholder="e.g. Kwabena"
          value={values.name}
          onChange={set('name')}
          error={errors.name ?? serverErrors.name}
        />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={set('email')}
          error={errors.email ?? serverErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={values.password}
          onChange={set('password')}
          error={errors.password ?? serverErrors.password}
        />
        {formError && <Notice tone="danger">{formError}</Notice>}
        <Button type="submit" block loading={register.isPending}>
          Continue
        </Button>
        <p className="small muted">
          Other learners only ever see your first name and the first letter of your surname. We never show
          your email.
        </p>
      </form>
      <p className="small muted" style={{ textAlign: 'center' }}>
        Have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
