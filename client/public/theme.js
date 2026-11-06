// Runs before the app renders so a saved dark theme never flashes light first. Kept in sync with ThemeContext.jsx.
try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
} catch {
  // Storage blocked: stay on the default light theme.
}
