const pad = (value: number) => String(value).padStart(2, '0');

/**
 * 把时间戳（毫秒）或 Date 格式化为本地时间 `YYYY-MM-DD HH:mm:ss`（各段补零）。
 * 无法解析时返回空字符串。
 */
export const formatDateTime = (value?: number | string | Date | null): string => {
  if (value === undefined || value === null || value === '') return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day} ${time}`;
};
