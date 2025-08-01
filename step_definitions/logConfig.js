// Dummy logger that only logs to console
export function getLogger() {
  return {
    info: console.log,
    warn: console.warn,
    error: console.error,
  };
}
