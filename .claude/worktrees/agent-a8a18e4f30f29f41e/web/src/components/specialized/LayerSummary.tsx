import { useState } from 'react';
import type { Provenance } from '../../../../packages/config-io/src/types';
import { provenanceLabel } from '../../schema/effective';

export interface LayerSummaryProps {
  layers: {
    canonical?: unknown;
    global?: unknown;
    project?: unknown;
  };
  effectiveSource: Provenance;
  className?: string;
}

const LAYER_ORDER: Provenance[] = ['canonical', 'global', 'project'];

function displayValue(value: unknown): string {
  if (value === undefined) return 'Not set';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return 'Value unavailable';
  }
}

export function LayerSummary({ layers, effectiveSource, className = '' }: LayerSummaryProps) {
  const [expanded, setExpanded] = useState<Provenance | null>(null);

  return (
    <section className={`gsd-layer-summary ${className}`.trim()} aria-label="Value provenance">
      <div className="gsd-layer-summary__heading">
        <div>
          <h3>Value source</h3>
          <p>Inspect where this value comes from before editing.</p>
        </div>
        <span className="gsd-provenance gsd-provenance--accent">{provenanceLabel(effectiveSource)} effective</span>
      </div>
      <div className="gsd-layer-summary__layers">
        {LAYER_ORDER.map((source) => {
          const isExpanded = expanded === source;
          const isEffective = source === effectiveSource;
          return (
            <div key={source} className={`gsd-layer-summary__layer ${isEffective ? 'gsd-layer-summary__layer--effective' : ''}`}>
              <button
                type="button"
                className="gsd-layer-summary__toggle"
                aria-expanded={isExpanded}
                onClick={() => setExpanded(isExpanded ? null : source)}
              >
                <span className={`gsd-provenance gsd-provenance--${source}`}>{provenanceLabel(source)}</span>
                {isEffective && <span className="gsd-layer-summary__effective">Effective</span>}
                <span aria-hidden="true">{isExpanded ? 'Hide details' : 'Show details'}</span>
              </button>
              {isExpanded && (
                <div className="gsd-layer-summary__value" tabIndex={0}>
                  {displayValue(layers[source])}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {effectiveSource !== 'project' && (
        <p className="gsd-layer-summary__scope">
          This value comes from {provenanceLabel(effectiveSource).toLowerCase()}. Editing it will create a project override; the inherited source remains unchanged.
        </p>
      )}
    </section>
  );
}
