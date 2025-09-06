export function createLogger() {
  return {
    info: (message) => console.log(`${message}`),
    success: (message) => console.log(`${message}`),
    error: (message) => console.error(`${message}`),
    warning: (message) => console.warn(`${message}`),
    progress: (message) => console.log(`${message}`)
  };
}