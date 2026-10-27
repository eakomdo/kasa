import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/shared/api/mock/demoAccounts';
import { resetDb } from '@/shared/api/mock/db';
import { renderWithProviders } from '@/test/render';
import { useSession } from '../session';
import LoginPage from './LoginPage';

beforeEach(() => {
  resetDb();
  useSession.getState().clear();
});

describe('LoginPage', () => {
  it('asks for missing fields before calling the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter the email you signed up with.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('shows the server message for a wrong password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });
    await user.type(screen.getByLabelText('Email'), DEMO_ACCOUNTS.student);
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText(/don’t match/)).toBeInTheDocument();
    expect(useSession.getState().token).toBeNull();
  });

  it('signs in and stores the session', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });
    await user.type(screen.getByLabelText('Email'), DEMO_ACCOUNTS.student);
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(useSession.getState().user?.name).toBe('Ama Mensah'));
  });
});
