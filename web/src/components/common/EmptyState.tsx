import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /**
   * `guided` stacks an optional `actions` group of primary next-step buttons
   * below the explanation (used for first-run / zero-config onboarding).
   * `default` keeps the compact centered layout used by in-editor states.
   */
  variant?: 'default' | 'guided';
  /** Up to three primary next-step buttons, rendered as a stacked group. */
  actions?: ReactNode;
  children?: ReactNode;
}

export function EmptyState({ title, description, icon, variant = 'default', actions, children }: EmptyStateProps) {
  return (
    <div className={`gsd-empty-state ${variant === 'guided' ? 'gsd-empty-state--guided' : ''}`}>
      {icon && <div className="gsd-empty-state__icon" aria-hidden="true">{icon}</div>}
      <h3 className="gsd-empty-state__title">{title}</h3>
      {description && <p className="gsd-empty-state__description">{description}</p>}
      {actions && <div className="gsd-empty-state__actions">{actions}</div>}
      {children && <div className="gsd-empty-state__content">{children}</div>}
    </div>
  );
}
