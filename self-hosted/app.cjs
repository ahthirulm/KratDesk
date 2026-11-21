// Node startup entry for process managers and cPanel-compatible VPS panels.
import('./start.mjs').catch((error) => {
  console.error(error);
  process.exit(1);
});
