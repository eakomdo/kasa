import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/shared/api/mock/demoAccounts';
import { env } from '@/shared/config/env';
import { useDocumentTitle } from '@/shared/lib/hooks';
import { Button, ButtonLink, Icon, Kente, Logo, Notice, errorMessage, type IconName } from '@/shared/ui';
import { useLogin } from '../api';
import styles from './Welcome.module.css';

const DEMO_WORDS = [
  { local: 'Maakye', english: 'Good morning', lang: 'Twi' },
  { local: 'Medaase', english: 'Thank you', lang: 'Twi' },
  { local: 'Oyiwaladɔŋŋ', english: 'Thank you', lang: 'Ga' },
  { local: 'Mmiɛnsa', english: 'Three', lang: 'Twi' },
];

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'units',
    title: 'Follows the GES syllabus',
    text: 'Units match what your class is learning, from Basic 1 to SHS 3, with a culture note in every unit.',
  },
  {
    icon: 'cards',
    title: 'BECE and WASSCE practice',
    text: 'Flashcards, exam-style questions and typing practice, with on-screen ɛ ɔ ŋ keys for any phone.',
  },
  {
    icon: 'cloudOff',
    title: 'Works without data',
    text: 'Save units on Wi-Fi and practise anywhere. Answers sync when you are back online.',
  },
  {
    icon: 'translate',
    title: 'Look up any word',
    text: 'Teacher-checked answers first, then Khaya AI by GhanaNLP. Learners suggest fixes; teachers review them.',
  },
  {
    icon: 'community',
    title: 'Learn with your class',
    text: 'Join your class with a code, ask questions, and get answers from verified teachers.',
  },
  {
    icon: 'shield',
    title: 'Safe for children',
    text: 'No private messages. Phone numbers and links are blocked, and moderators review every report.',
  },
];

export default function WelcomePage() {
  useDocumentTitle('Learn Twi and Ga');
  const navigate = useNavigate();
  const login = useLogin();

  // Record the destination first: <GuestOnly> redirects as soon as the session exists.
  const explore = (email: string, to: string) => {
    navigate('/welcome', { replace: true, state: { from: to } });
    login.mutate({ email, password: DEMO_PASSWORD });
  };

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <div className={`${styles.inner} ${styles.navRow}`}>
          <Logo size={30} />
          <nav className={styles.navLinks} aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#schools">For schools</a>
            <a href="#parents">For parents</a>
          </nav>
          <div className={styles.navActions}>
            <ButtonLink to="/login" variant="ghost" size="sm">
              Log in
            </ButtonLink>
            <ButtonLink to="/register" size="sm" className="desktop-only">
              Get started
            </ButtonLink>
          </div>
        </div>
      </header>

      <main id="main">
        <section className={`${styles.inner} ${styles.hero}`}>
          <div className="stack" style={{ gap: 24 }}>
            <span className={styles.eyebrowPill}>
              <Icon name="school" size={16} />
              Built on the GES curriculum
            </span>
            <h1 className={styles.heroTitle}>
              Learn Twi and Ga the way <em>your syllabus</em> teaches it.
            </h1>
            <p className={styles.heroLead}>
              Five minutes a day. Words come back right before you forget them, so they stick for exams and
              for life.
            </p>
            <div className={styles.ctas}>
              <ButtonLink to="/register" variant="gold">
                Start learning, it’s free
              </ButtonLink>
              <ButtonLink to="/login" variant="ghost">
                I have an account
              </ButtonLink>
            </div>
            <div className={styles.facts}>
              <span>
                <Icon name="check" size={16} /> Basic 1 to SHS 3
              </span>
              <span>
                <Icon name="check" size={16} /> Works offline
              </span>
              <span>
                <Icon name="check" size={16} /> Installs from your browser
              </span>
            </div>
          </div>
          <FlashcardDemo />
        </section>

        {env.showDemo && (
          <section className={styles.inner} style={{ paddingBottom: 48 }} aria-labelledby="preview-title">
            <div className={styles.preview}>
              <h2 id="preview-title">Explore the preview</h2>
              <p className="small muted">
                Sign in as a sample account. Nothing you do here leaves this browser.
              </p>
              {login.error && <Notice tone="danger">{errorMessage(login.error)}</Notice>}
              <div className={styles.previewButtons}>
                <Button
                  size="sm"
                  variant="subtle"
                  loading={login.isPending}
                  onClick={() => explore(DEMO_ACCOUNTS.student, '/')}
                >
                  Ama, a JHS 1 student
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  loading={login.isPending}
                  onClick={() => explore(DEMO_ACCOUNTS.teacher, '/community')}
                >
                  Mr Boateng, a verified teacher
                </Button>
                <Button
                  size="sm"
                  variant="subtle"
                  loading={login.isPending}
                  onClick={() => explore(DEMO_ACCOUNTS.admin, '/admin')}
                >
                  Efua, a community admin
                </Button>
              </div>
            </div>
          </section>
        )}

        <section id="how" className={styles.section}>
          <div className={styles.inner}>
            <div className={styles.sectionHead}>
              <p className="eyebrow">How it works</p>
              <h2>Little and often beats long and rare.</h2>
            </div>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <span className={styles.stepNum}>1</span>
                <h3>Choose your class</h3>
                <p>Pick Twi or Ga and your class. Kasa loads the units your syllabus covers this year.</p>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNum}>2</span>
                <h3>Practise for five minutes</h3>
                <p>Say each word out loud, flip the card, and hear how it’s pronounced.</p>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNum}>3</span>
                <h3>Words come back on time</h3>
                <p>
                  Get it right and a word returns in 1, 3, 7, 14 and 30 days. Miss it and it comes back
                  tomorrow.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section id="features" className={styles.section}>
          <div className={styles.inner}>
            <div className={styles.sectionHead}>
              <p className="eyebrow">Features</p>
              <h2>Made for Ghanaian classrooms, phones and data bundles.</h2>
            </div>
            <div className={styles.features}>
              {FEATURES.map((f) => (
                <div key={f.title} className={styles.feature}>
                  <span className={styles.featureIcon}>
                    <Icon name={f.icon} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.inner} ${styles.audiences}`}>
            <div id="schools" className={`${styles.audience} ${styles.schools}`}>
              <p className="eyebrow" style={{ color: 'var(--muted)' }}>
                For schools and teachers
              </p>
              <h2>Bring your whole class in with one code.</h2>
              <ul>
                <li>Start a class community and share a code like ASF-7B on the board.</li>
                <li>Approve join requests, pin homework and answer questions as a verified teacher.</li>
                <li>Weekly school leaderboards keep friendly competition going.</li>
                <li>Sign up like a learner; the Kasa team verifies teacher accounts.</li>
              </ul>
              <div>
                <ButtonLink to="/register" variant="gold" size="sm">
                  Get started as a teacher
                </ButtonLink>
              </div>
            </div>
            <div id="parents" className={`${styles.audience} ${styles.parents}`}>
              <p className="eyebrow">For parents and guardians</p>
              <h2>Know they are learning, and know they are safe.</h2>
              <ul>
                <li>Primary pupils sign up with a parent or guardian’s email.</li>
                <li>Other learners only ever see a first name and initial.</li>
                <li>No private messages, no phone numbers, no links. Moderators check reports every day.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.inner} ${styles.proverb}`}>
            <Kente />
            <blockquote lang="tw">Nyansa nni onipa baako ti mu.</blockquote>
            <p className="muted">Wisdom is not in one person’s head. Learn together.</p>
            <ButtonLink to="/register">Start learning</ButtonLink>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.inner} ${styles.footerRow}`}>
          <Logo size={24} />
          <span>Twi and Ga for every Ghanaian classroom.</span>
          <span>
            <Link to="/login">Log in</Link> · <Link to="/register">Create an account</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** A real, tappable flashcard so visitors feel the product before signing up. */
function FlashcardDemo() {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const w = DEMO_WORDS[i]!;
  const next = () => {
    setFlipped(false);
    setI((n) => (n + 1) % DEMO_WORDS.length);
  };
  return (
    <section className={styles.demo} aria-label="Try a flashcard">
      <Kente thin />
      <div className={styles.demoTop}>
        <span>Try it now</span>
        <span>{w.lang}</span>
      </div>
      <button
        type="button"
        className={styles.demoCard}
        data-flipped={flipped}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? `${w.local} means ${w.english}` : `${w.local}. Tap to see what it means.`}
      >
        <span className="eyebrow" style={{ color: 'inherit', opacity: 0.7 }}>
          {flipped ? 'English' : w.lang}
        </span>
        <span className={styles.demoWord} lang={flipped ? 'en' : w.lang === 'Ga' ? 'gaa' : 'tw'}>
          {flipped ? w.english : w.local}
        </span>
        <span className={styles.demoHint}>{flipped ? w.local : 'Say it out loud, then tap'}</span>
      </button>
      <div className={styles.demoActions}>
        <button type="button" className={styles.demoGhost} onClick={() => setFlipped((f) => !f)}>
          {flipped ? 'Show word' : 'Flip card'}
        </button>
        <button type="button" className={styles.demoSolid} onClick={next}>
          Next word
        </button>
      </div>
      <div className={styles.demoDots} aria-hidden="true">
        {DEMO_WORDS.map((d, n) => (
          <span key={d.local} data-on={n === i} />
        ))}
      </div>
    </section>
  );
}
