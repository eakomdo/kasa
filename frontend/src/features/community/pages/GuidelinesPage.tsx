import { useDocumentTitle } from '@/shared/lib/hooks';
import { ButtonLink, Notice, PageHeader } from '@/shared/ui';
import styles from '../community.module.css';

const RULES = [
  {
    title: 'Be kind',
    body: 'Everyone here is still learning, including teachers. Correct mistakes gently and never mock anyone’s Twi or Ga.',
  },
  {
    title: 'Explain, don’t just answer',
    body: 'Help people understand why. Don’t post full homework or exam answers for someone to copy.',
  },
  {
    title: 'Keep yourself private',
    body: 'Never share your phone number, email, home address, school timetable or social media. Never arrange to meet anyone from Kasa. Posts with contact details are blocked.',
  },
  {
    title: 'Stay on topic',
    body: 'Talk about learning Ghanaian languages, culture and exams. No adverts, selling or chain messages.',
  },
  {
    title: 'Report problems',
    body: 'If something makes you uncomfortable, tap Report. Reports are private and the person won’t know it was you.',
  },
  {
    title: 'Trust the badges',
    body: 'Teachers are checked by the Kasa team and wear a green Teacher badge. Moderators review reports every day.',
  },
];

export default function GuidelinesPage() {
  useDocumentTitle('Community rules');
  return (
    <>
      <PageHeader
        backTo="/community"
        title="Community rules"
        subtitle="Six rules that keep every Kasa community a safe place to learn."
      />
      <section className={styles.panel}>
        <ol className={styles.rules}>
          {RULES.map((r) => (
            <li key={r.title}>
              <div>
                <h3>{r.title}</h3>
                <p className="muted">{r.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className={styles.panel} aria-labelledby="how-heading">
        <h2 id="how-heading">How communities work</h2>
        <dl className="stack small" style={{ margin: 0 }}>
          <div>
            <dt style={{ fontWeight: 700 }}>Starting one</dt>
            <dd style={{ margin: 0 }} className="muted">
              Anyone can propose a community for their class, school, study group or interest. A Kasa
              moderator checks it before it goes live, and the person who started it becomes its owner.
            </dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Joining</dt>
            <dd style={{ margin: 0 }} className="muted">
              Open communities: join with one tap. Ask to join: a helper or admin approves your request. Class
              code: type the code your teacher shares, or tap their link.
            </dd>
          </div>
          <div>
            <dt style={{ fontWeight: 700 }}>Roles</dt>
            <dd style={{ margin: 0 }} className="muted">
              Owners and admins run a community. Admins are always teachers or Kasa staff. Students can be
              helpers: they approve join requests and pin useful posts. Removing posts and members is done by
              teachers and Kasa moderators.
            </dd>
          </div>
        </dl>
      </section>
      <Notice icon="shield" title="If someone asks to meet you or for your number">
        Don’t reply. Report the post, and tell a parent, guardian or teacher. Moderators act on these reports
        first.
      </Notice>
      <ButtonLink to="/community" variant="ghost">
        Back to the community
      </ButtonLink>
    </>
  );
}
