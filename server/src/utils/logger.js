export const logger = {
  info: (message, meta = {}) => console.info(JSON.stringify({ level: 'info', message, ...meta })),
  warn: (message, meta = {}) => console.warn(JSON.stringify({ level: 'warn', message, ...meta })),
  error: (message, meta = {}) => console.error(JSON.stringify({ level: 'error', message, ...meta }))
};
