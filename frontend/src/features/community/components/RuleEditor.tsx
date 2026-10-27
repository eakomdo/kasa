import { Button, IconButton, TextField } from '@/shared/ui';
import styles from '../community.module.css';

/** Up to six short community rules, edited inline. */
export function RuleEditor({
  rules,
  onChange,
  error,
}: {
  rules: string[];
  onChange: (r: string[]) => void;
  error?: string;
}) {
  return (
    <div className={styles.ruleEditor}>
      <span className="small" style={{ fontWeight: 700 }}>
        Rules (up to 6)
      </span>
      {rules.map((r, i) => (
        <div key={i} className={styles.ruleRow}>
          <TextField
            label={`Rule ${i + 1}`}
            hideLabel
            value={r}
            maxLength={140}
            onChange={(e) => onChange(rules.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <IconButton
            icon="close"
            label={`Remove rule ${i + 1}`}
            onClick={() => onChange(rules.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {error && (
        <span className="small" role="alert" style={{ color: 'var(--danger)', fontWeight: 600 }}>
          {error}
        </span>
      )}
      {rules.length < 6 && (
        <Button size="sm" variant="subtle" icon="plus" onClick={() => onChange([...rules, ''])}>
          Add a rule
        </Button>
      )}
    </div>
  );
}
