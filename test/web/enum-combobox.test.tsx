// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EnumCombobox } from '../../web/src/components/fields/EnumCombobox';

afterEach(() => {
  cleanup();
});

describe('EnumCombobox', () => {
  it('renders string enum options and emits the string value', () => {
    const onChange = vi.fn();
    render(<EnumCombobox id="mode" label="Mode" value="interactive" options={['interactive', 'yolo']} meanings={{}} onChange={onChange} />);
    const select = screen.getByLabelText('Mode') as HTMLSelectElement;
    expect(select.value).toBe('interactive');
    fireEvent.change(select, { target: { value: 'yolo' } });
    expect(onChange).toHaveBeenCalledWith('yolo');
  });

  it('renders "(unset)" for a null option and emits null when selected', () => {
    const onChange = vi.fn();
    render(<EnumCombobox id="provider" label="Provider" value="anthropic" options={['openai', 'anthropic', null]} meanings={{}} onChange={onChange} />);
    const select = screen.getByLabelText('Provider') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'openai', 'anthropic']);
    expect(Array.from(select.options).map((option) => option.text)).toEqual(['(unset)', 'openai', 'anthropic']);
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('selects the "(unset)" option when the current value is null', () => {
    render(<EnumCombobox id="provider" label="Provider" value={null} options={['openai', 'anthropic', null]} meanings={{}} onChange={() => undefined} />);
    expect((screen.getByLabelText('Provider') as HTMLSelectElement).value).toBe('');
  });

  it('preserves the boolean type of enum values', () => {
    const onChange = vi.fn();
    render(<EnumCombobox id="fast" label="Fast" value={true} options={[true, false]} meanings={{}} onChange={onChange} />);
    const select = screen.getByLabelText('Fast') as HTMLSelectElement;
    expect(select.value).toBe('true');
    fireEvent.change(select, { target: { value: 'false' } });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('preserves the number type of enum values', () => {
    const onChange = vi.fn();
    render(<EnumCombobox id="tier" label="Tier" value={1} options={[1, 2, 3]} meanings={{}} onChange={onChange} />);
    const select = screen.getByLabelText('Tier') as HTMLSelectElement;
    expect(select.value).toBe('1');
    fireEvent.change(select, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
