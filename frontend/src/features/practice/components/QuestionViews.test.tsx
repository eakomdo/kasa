import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LANGUAGES } from '@/shared/config/languages';
import type { SessionCard } from '../model/session';
import { ChoiceView, TypingView } from './QuestionViews';

const card: SessionCard = {
  id: 'tw-num-w3',
  unitId: 'tw-num',
  lang: 'twi',
  kind: 'word',
  english: 'Three',
  translation: 'Mmiɛnsa',
  audioUrl: null,
  mastery: null,
  distractors: ['Baako', 'Mmienu', 'Ɛnan'],
  isNew: true,
  options: ['Baako', 'Mmiɛnsa', 'Mmienu', 'Ɛnan'],
  isRetry: false,
};

describe('TypingView', () => {
  it('inserts Twi letters from the on-screen keys and submits the answer', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TypingView card={card} language={LANGUAGES.twi} answered={false} onSubmit={onSubmit} />);

    const input = screen.getByLabelText(/your answer in twi/i);
    await user.type(input, 'mmi');
    await user.click(screen.getByRole('button', { name: 'Insert ɛ' }));
    await user.type(input, 'nsa');
    expect(input).toHaveValue('mmiɛnsa');

    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(onSubmit).toHaveBeenCalledWith('mmiɛnsa');
  });

  it('keeps Check disabled until something is typed', () => {
    render(<TypingView card={card} language={LANGUAGES.twi} answered={false} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });
});

describe('ChoiceView', () => {
  it('grades the chosen option', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<ChoiceView card={card} language={LANGUAGES.twi} given={null} grade={null} onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: /Mmienu/ }));
    expect(onAnswer).toHaveBeenCalledWith('wrong', 'Mmienu');
    await user.click(screen.getByRole('button', { name: /Mmiɛnsa/ }));
    expect(onAnswer).toHaveBeenLastCalledWith('correct', 'Mmiɛnsa');
  });

  it('locks the options once answered', () => {
    render(
      <ChoiceView card={card} language={LANGUAGES.twi} given="Baako" grade="wrong" onAnswer={vi.fn()} />,
    );
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled();
  });
});
