/**
 * 统一处理前端 API Base URL
 *
 * 约定：
 * - VITE_API_BASE_URL 为空或为 "/"：表示同源（生产环境 Nginx 反代 /api）
 * - 其他情况（如 http://localhost:8000）：作为绝对地址使用
 */

/**
 * 获取标准化的 API 基础 URL
 * @returns {string} 标准化后的基础 URL（不含末尾斜杠）
 */
export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL;

  // 空值或 "/" 视为同源，返回空字符串
  if (!raw || raw === '/') {
    return '';
  }

  // 移除末尾的斜杠
  return String(raw).replace(/\/+$/, '');
}

/**
 * 构建完整的 API URL
 * @param {string} path - API 路径（应以 / 开头）
 * @returns {string} 完整的 API URL
 */
export function buildApiUrl(path) {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${base}${normalizedPath}`;
}
