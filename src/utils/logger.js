const isProd = import.meta.env.PROD;

export const logger = {
  info: (...args) => {
    if (!isProd) console.info(...args);
  },
  warn: (...args) => {
    if (!isProd) console.warn(...args);
  },
  error: (...args) => {
    if (!isProd) console.error(...args);
  }
};
