import { useUiStore } from '../../state/uiStore';
import { Icons } from './Icons';

/**
 * Dark/light switch anchored at the bottom of the rail. Dark is the default;
 * the toggle stamps `:root[data-theme='light']` via the store and persists the
 * choice to localStorage. The icon shows what you'll switch TO (sun → light).
 */
export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const isDark = theme === 'dark';
  const next: 'light' | 'dark' = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="gsd-rail-button gsd-theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {isDark ? <Icons.sun size={16} /> : <Icons.moon size={16} />}
    </button>
  );
}
