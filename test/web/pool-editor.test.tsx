// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PoolEntryList } from '../../web/src/components/specialized/PoolEntryList';

describe('PoolEntryList', () => {
  it('names entries and exposes safe boundary reorder actions', () => {
    const onMove = vi.fn();
    render(<PoolEntryList entries={[{ heading: 'First' }, { heading: 'Second' }]} selectedIndex={0} onSelect={vi.fn()} onAdd={vi.fn()} onMove={onMove} onRemove={vi.fn()} />);
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move First up' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Move First down' }));
    expect(onMove).toHaveBeenCalledWith(0, 1);
  });

  it('marks invalid rows and confirms removal by name through a labeled action', () => {
    const onRemove = vi.fn();
    render(<PoolEntryList entries={[{ name: 'Release notes' }]} selectedIndex={null} onSelect={vi.fn()} onAdd={vi.fn()} onMove={vi.fn()} onRemove={onRemove} invalidIndexes={new Set([0])} />);
    expect(screen.getByText('Needs attention')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Release notes' }));
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
