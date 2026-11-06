import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'theme';
const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

// Light is the default. public/theme.js applies a saved choice before first paint; this keeps it in sync afterwards.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  }, [theme]);
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
