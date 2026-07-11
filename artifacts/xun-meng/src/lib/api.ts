/** Base URL for API requests. In dev, defaults to "" (Vite proxies /api).
 *  In production (GitHub Pages), set VITE_API_BASE_URL to your Render backend.
 *  Example: https://xunmeng-api.onrender.com
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
