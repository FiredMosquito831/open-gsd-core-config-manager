import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export function EmptyState({ title, description, icon, children }: EmptyStateProps) {
  return (
    <div className="gsd-empty-state">
      {icon && <div className="gsd-empty-state__icon" aria-hidden="true">{icon}</div>}
      <h3 className="gsd-empty-state__title">{title}</h3>
      {description && <p className="gsd-empty-state__description">{description}</p>}
      {children && <div className="gsd-empty-state__actions">{children}</div>}
    </div>
  );
}
