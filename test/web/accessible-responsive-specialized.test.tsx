import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoolEntryList } from '../../web/src/components/specialized/PoolEntryList';

describe('specialized workspace accessibility contract', () => {
  it('keeps long names and labeled actions available', () => {
    render(<PoolEntryList entries={[{ name: 'A very long configuration entry name that must wrap instead of clipping actions' }]} selectedIndex={0} onSelect={() => undefined} onAdd={() => undefined} onMove={() => undefined} onRemove={() => undefined} />);
    expect(screen.getByText(/A very long configuration entry name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move .* down/ })).toBeInTheDocument();
  });
});
