import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface EnumComboboxProps {
  value: unknown;
  options: unknown[];
  meanings: Record<string, string>;
  id: string;
  label: string;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** id of the chosen-meaning element, wired to aria-describedby. */
  describedById?: string;
}

/** Above this many options we swap the native select for a searchable combobox. */
const COMBOBOX_THRESHOLD = 8;

/** Split `text` and highlight every case-insensitive occurrence of `query`. */
function highlight(text: string, query: string): Array<{ chunk: string; match: boolean }> {
  if (!query) return [{ chunk: text, match: false }];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const out: Array<{ chunk: string; match: boolean }> = [];
  let from = 0;
  let idx = lower.indexOf(q, from);
  while (idx !== -1) {
    if (idx > from) out.push({ chunk: text.slice(from, idx), match: false });
    out.push({ chunk: text.slice(idx, idx + q.length), match: true });
    from = idx + q.length;
    idx = lower.indexOf(q, from);
  }
  if (from < text.length) out.push({ chunk: text.slice(from), match: false });
  return out;
}

export function EnumCombobox({
  value,
  options,
  meanings,
  id,
  label,
  onChange,
  onBlur,
  disabled,
  describedById,
}: EnumComboboxProps) {
  const listboxId = useId();
  const hasNull = options.includes(null);
  const currentKey = value === null || value === undefined ? '' : String(value);
  const currentMeaning = currentKey ? meanings[currentKey] : undefined;

  // Stable index-based identity so values with equal string form
  // (e.g. numeric 1 vs string "1") never collide in DOM value / React key.
  const items = useMemo(() => {
    const list: Array<{ index: number; value: unknown; key: string; meaning?: string; isNull: boolean }> = [];
    if (hasNull) list.push({ index: -1, value: null, key: '', meaning: undefined, isNull: true });
    options.forEach((option, i) => {
      if (option === null) return;
      const key = String(option);
      list.push({ index: i, value: option, key, meaning: meanings[key], isNull: false });
    });
    return list;
  }, [options, meanings, hasNull]);

  const selectedItem = items.find((item) =>
    item.isNull ? value === null || value === undefined : item.value === value,
  );

  const chosenMeaningEl = (
    <p
      id={describedById}
      className={`gsd-field-card__selected-meaning ${currentMeaning ? '' : 'gsd-field-card__selected-meaning--empty'}`}
    >
      {currentMeaning ?? (hasNull && currentKey === '' ? 'No value selected — uses the inherited default.' : 'No description yet for this option.')}
    </p>
  );

  // ---- Short enums: keep the native select, show the chosen meaning below. ----
  // FieldCard supplies the outer .gsd-field-card__control wrapper, so this
  // returns a fragment of the bare control + its chosen-meaning line.
  if (items.length <= COMBOBOX_THRESHOLD) {
    return (
      <>
        <select
          id={id}
          value={currentKey}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '' && hasNull) {
              onChange(null);
              return;
            }
            const matched = options.find((option) => option !== null && String(option) === raw);
            onChange(matched !== undefined ? matched : raw);
          }}
          disabled={disabled}
          onBlur={onBlur}
          className="gsd-field-card__select"
          aria-label={label}
          aria-describedby={describedById}
        >
          {hasNull && <option value="">(unset)</option>}
          {options.filter((option) => option !== null).map((option) => {
            const key = String(option);
            const meaning = meanings[key];
            const text = meaning ? `${key} — ${meaning}` : key;
            return (
              <option key={key} value={key}>
                {text}
              </option>
            );
          })}
        </select>
        {chosenMeaningEl}
      </>
    );
  }

  // ---- Long enums: real accessible combobox (input + listbox). ----
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | undefined>(undefined);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const meaning = item.meaning ?? '';
      return item.key.toLowerCase().includes(q) || meaning.toLowerCase().includes(q);
    });
  }, [items, query]);

  const openMenu = () => {
    setQuery('');
    setActiveIndex(Math.max(0, filtered.findIndex((item) => item.value === value)));
    setOpen(true);
  };

  const closeMenu = (focusInput = false) => {
    setOpen(false);
    setQuery('');
    if (focusInput) inputRef.current?.focus();
  };

  const selectItem = (item: (typeof items)[number] | undefined) => {
    if (!item) return;
    onChange(item.value);
    closeMenu(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return;
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      if (open) {
        e.preventDefault();
        setActiveIndex(0);
      }
    } else if (e.key === 'End') {
      if (open) {
        e.preventDefault();
        setActiveIndex(filtered.length - 1);
      }
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault();
        selectItem(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        closeMenu(true);
      }
    } else if (e.key === 'Tab') {
      if (open) closeMenu(false);
    }
  };

  const displayValue = open ? query : selectedItem?.key ?? '';

  return (
    // FieldCard supplies the outer .gsd-field-card__control wrapper.
    <>
      <div className="gsd-combobox">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={label}
          aria-describedby={describedById}
          aria-activedescendant={open && filtered[activeIndex] ? `${listboxId}-opt-${filtered[activeIndex].index}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={displayValue}
          placeholder={selectedItem ? selectedItem.key : 'Search options…'}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            window.clearTimeout(blurTimer.current);
            if (!open) openMenu();
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => closeMenu(false), 120);
          }}
          onKeyDown={handleKeyDown}
          onClick={() => {
            if (!open) openMenu();
          }}
        />
        <ul
          id={listboxId}
          role="listbox"
          className="gsd-combobox__listbox"
          hidden={!open}
        >
          {filtered.length === 0 && <li className="gsd-combobox__empty">No options match “{query}”.</li>}
          {filtered.map((item) => {
            const active = item === filtered[activeIndex];
            const selected = item.value === value;
            const optionId = `${listboxId}-opt-${item.index}`;
            return (
              <li
                key={item.isNull ? 'null' : `o${item.index}`}
                id={optionId}
                role="option"
                aria-selected={selected}
                className={`gsd-combobox__option ${active ? 'gsd-combobox__option--active' : ''} ${selected ? 'gsd-combobox__option--selected' : ''}`}
                onMouseEnter={() => setActiveIndex(filtered.indexOf(item))}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(item);
                }}
              >
                <span className="gsd-combobox__option-key">
                  {item.isNull ? '(unset)' : highlight(item.key, query).map((seg, i) =>
                    seg.match ? <mark key={i} className="gsd-combobox__match">{seg.chunk}</mark> : <span key={i}>{seg.chunk}</span>,
                  )}
                </span>
                {item.meaning && (
                  <span className="gsd-combobox__option-meaning">
                    {highlight(item.meaning, query).map((seg, i) =>
                      seg.match ? <mark key={i} className="gsd-combobox__match">{seg.chunk}</mark> : <span key={i}>{seg.chunk}</span>,
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {open && (
        <p className="gsd-combobox__count" role="status">
          {filtered.length} of {items.length} options
        </p>
      )}
      {chosenMeaningEl}
      </>
  );
}
