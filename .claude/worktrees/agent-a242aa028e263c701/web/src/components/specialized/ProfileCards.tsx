import { Button } from '../common/Button';
import { SPECIALIZED_METADATA } from '../../schema/specializedMetadata';

export const PROFILE_DESCRIPTIONS: Record<string, string> = {
  quality: 'Favor the strongest available models for careful, high-confidence work.',
  balanced: 'Use a practical mix of capability, speed, and cost for everyday work.',
  budget: 'Prefer lower-cost models while keeping the normal GSD workflow intact.',
  adaptive: 'Let runtime and task context steer the selected model tier.',
  inherit: 'Leave profile selection to the inherited configuration layers.',
};

const profiles = SPECIALIZED_METADATA.find((item) => item.path === 'model_profile')?.allowedValues?.filter((value): value is string => typeof value === 'string') ?? ['quality', 'balanced', 'budget', 'adaptive', 'inherit'];

interface ProfileCardsProps {
  value: string;
  onSelect: (profile: string) => void;
  onCreate: (profile: string) => void;
}

export function ProfileCards({ value, onSelect, onCreate }: ProfileCardsProps) {
  return (
    <section className="gsd-profile-chapter" aria-label="Model profiles">
      <div className="gsd-profile-chapter__intro">
        <p className="gsd-focused-workspace__eyebrow">Model routing</p>
        <h2>Profiles</h2>
        <p>Start with a source-confirmed built-in selector, then copy its assignments into this project when you need a focused adjustment.</p>
      </div>
      <div className="gsd-profile-cards" role="list" aria-label="Built-in model profiles">
        {profiles.map((profile) => (
          <article key={profile} role="listitem" className={`gsd-profile-card ${value === profile ? 'gsd-profile-card--selected' : ''}`}>
            <button type="button" className="gsd-profile-card__select" aria-pressed={value === profile} onClick={() => onSelect(profile)}>
              <span className="gsd-profile-card__name">{profile}</span>
              <span className="gsd-profile-card__description">{PROFILE_DESCRIPTIONS[profile]}</span>
              <span className="gsd-profile-card__assignment">Built-in selector · project model configuration</span>
            </button>
          </article>
        ))}
      </div>
      <div className="gsd-profile-create">
        <div>
          <h3>Adjust this project</h3>
          <p>Copy the selected built-in assignment set into ordinary project fields. This creates a project configuration, not a reusable named GSD profile.</p>
        </div>
        <Button variant="primary" size="md" onClick={() => onCreate(value)}>Create custom project configuration</Button>
      </div>
    </section>
  );
}
