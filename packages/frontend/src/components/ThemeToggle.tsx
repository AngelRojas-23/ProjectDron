/**
 * ThemeToggle component
 * A small button to toggle between light and dark mode
 */
import { useThemeStore, theme as themeColors } from '../store/theme';

export function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode);
  const toggle = useThemeStore((state) => state.toggle);
  const t = themeColors[mode];

  return (
    <button
      onClick={toggle}
      style={{
        ...styles.button,
        backgroundColor: t.hover,
      }}
      title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {mode === 'light' ? '🌙' : '☀️'}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    border: 'none',
    cursor: 'pointer',
    padding: '0.5rem',
    fontSize: '1.25rem',
    lineHeight: 1,
    borderRadius: '4px',
    transition: 'background-color 0.2s ease',
  },
};