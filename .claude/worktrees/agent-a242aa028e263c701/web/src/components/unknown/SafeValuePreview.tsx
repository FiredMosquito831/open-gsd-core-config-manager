interface SafeValuePreviewProps {
  value: unknown;
  maxLength?: number;
  maxDepth?: number;
}

export function valueType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function formatBounded(value: unknown, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return '…';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.slice(0, 8).map((item) => formatBounded(item, depth + 1, maxDepth));
    const suffix = value.length > 8 ? ', …' : '';
    return `[${items.join(', ')}${suffix}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 8);
    const body = entries
      .map(([key, item]) => `${key}: ${formatBounded(item, depth + 1, maxDepth)}`)
      .join(', ');
    const suffix = Object.keys(value as Record<string, unknown>).length > 8 ? ', …' : '';
    return `{${body}${suffix}}`;
  }
  return String(value);
}

export function SafeValuePreview({ value, maxLength = 800, maxDepth = 3 }: SafeValuePreviewProps) {
  const formatted = formatBounded(value, 0, maxDepth);
  const bounded = formatted.length > maxLength ? `${formatted.slice(0, maxLength - 1)}…` : formatted;
  return <pre className="gsd-safe-value-preview">{bounded}</pre>;
}
