import { useState } from 'react';
import { useSession } from '@/features/auth/session';
import { audioUrlFor } from '@/shared/api/client';
import type { VocabItem } from '@/shared/api/schemas';
import { env } from '@/shared/config/env';
import { getLanguage } from '@/shared/config/languages';
import { Icon, toast } from '@/shared/ui';
import styles from './AudioButton.module.css';

/** One player for the whole app, so tapping a second word stops the first. */
let player: HTMLAudioElement | null = null;

type Playable = Pick<VocabItem, 'translation' | 'audioUrl' | 'lang'>;

export function AudioButton({
  item,
  size = 'md',
  tone = 'default',
}: {
  item: Playable;
  size?: 'md' | 'lg';
  tone?: 'default' | 'onHero';
}) {
  const voice = useSession((s) => s.user?.voice ?? 'female');
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    if (env.useMocks && !item.audioUrl) {
      setPlaying(true);
      window.setTimeout(() => setPlaying(false), 900);
      toast(`“${item.translation}”: audio plays here once Kasa is connected to Khaya AI.`);
      return;
    }
    try {
      player?.pause();
      player = new Audio(audioUrlFor(item, getLanguage(item.lang).khaya.tts, voice));
      player.preload = 'none';
      setPlaying(true);
      player.onended = () => setPlaying(false);
      player.onerror = () => setPlaying(false);
      await player.play();
    } catch {
      setPlaying(false);
      toast(
        navigator.onLine
          ? 'That recording didn’t play. Try again in a moment.'
          : 'Audio needs data unless you’ve played this word before.',
        'error',
      );
    }
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${size === 'lg' ? styles.lg : ''} ${tone === 'onHero' ? styles.onHero : ''} ${playing ? styles.playing : ''}`}
      onClick={() => void play()}
      aria-label={`Play pronunciation of ${item.translation}`}
      title="Play pronunciation"
    >
      <Icon name="speaker" size={size === 'lg' ? 24 : 20} />
    </button>
  );
}
