/**
 * 轻量日志工具：带时间戳/级别，便于排错。
 * 用法：logger.info('message', { extra }); logger.error(err, { ctx: 'initCharts' });
 */
const formatTS = () => new Date().toISOString();

function log(level, message, meta) {
  const payload = meta ? { ...meta } : undefined;
  const prefix = `[${formatTS()}][${level}]`;
  if (level === 'error') {
    console.error(prefix, message, payload);
  } else if (level === 'warn') {
    console.warn(prefix, message, payload);
  } else {
    console.log(prefix, message, payload);
  }
}

export const logger = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (err, meta) => {
    const message = err instanceof Error ? err.message : err;
    const stack = err instanceof Error ? err.stack : undefined;
    log('error', message, { stack, ...meta });
  },
};
